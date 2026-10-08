"""Lectura de Excel aislada en subproceso con timeout (ADR-0001)."""

import multiprocessing as mp
import queue as stdlib_queue
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook

from backend.app.core.config import settings
from backend.app.errors import (
    InvalidWorkbookError,
    WorkbookLimitError,
    WorkbookNotFoundError,
    WorkbookParseTimeoutError,
)

_CTX = mp.get_context("spawn")


def _cell(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (int, float, str, bool)):
        return value
    return str(value)


def _width(row: tuple[Any, ...]) -> int:
    width = len(row)
    while width > 0 and row[width - 1] is None:
        width -= 1
    return width


def _metadata_worker(path: str, result_queue: Any) -> None:
    try:
        workbook = load_workbook(path, read_only=True, data_only=True)
        sheets: list[dict] = []
        for ws in workbook.worksheets:
            total = 0
            cols = 0
            for row in ws.iter_rows(values_only=True):
                total += 1
                cols = max(cols, _width(row))
            sheets.append({"name": ws.title, "rows": max(total - 1, 0), "cols": cols})
        workbook.close()
        result_queue.put(("ok", sheets))
    except Exception as exc:
        result_queue.put(("err", ("invalid", str(exc))))


def _rows_worker(path: str, sheet: str, offset: int, limit: int, result_queue: Any) -> None:
    try:
        workbook = load_workbook(path, read_only=True, data_only=True)
        if sheet not in workbook.sheetnames:
            workbook.close()
            result_queue.put(("err", ("notfound", f"La hoja '{sheet}' no existe")))
            return
        ws = workbook[sheet]
        header: list[Any] = []
        page: list[list[Any]] = []
        total = 0
        seen_header = False
        for row in ws.iter_rows(values_only=True):
            if not seen_header:
                header = [_cell(value) for value in row]
                seen_header = True
                continue
            if total >= offset and len(page) < limit:
                page.append([_cell(value) for value in row])
            total += 1
        workbook.close()
        result_queue.put(("ok", {"header": header, "rows": page, "total": total}))
    except Exception as exc:
        result_queue.put(("err", ("invalid", str(exc))))


def _run(target: Any, args: tuple, timeout_s: float) -> Any:
    result_queue: Any = _CTX.Queue()
    process = _CTX.Process(target=target, args=(*args, result_queue))
    process.start()
    process.join(timeout_s)
    if process.is_alive():
        process.terminate()
        process.join(1.0)
        process.close()
        raise WorkbookParseTimeoutError(f"El parser supero {timeout_s} segundos")
    try:
        item = result_queue.get(timeout=2.0)
    except stdlib_queue.Empty:
        raise WorkbookParseTimeoutError("El parser termino sin resultado") from None
    finally:
        process.close()
    kind, payload = item
    if kind == "ok":
        return payload
    code, message = payload
    if code == "notfound":
        raise WorkbookNotFoundError(message)
    raise InvalidWorkbookError(f"No se pudo leer el Excel: {message}")


def _check_limits(sheets: list[dict]) -> None:
    if len(sheets) > settings.max_sheets:
        raise WorkbookLimitError(f"Maximo {settings.max_sheets} hojas por libro")
    for sheet in sheets:
        if sheet["cols"] > settings.max_columns:
            raise WorkbookLimitError(
                f"La hoja '{sheet['name']}' supera {settings.max_columns} columnas"
            )
        if sheet["rows"] > settings.max_rows_per_sheet:
            raise WorkbookLimitError(
                f"La hoja '{sheet['name']}' supera {settings.max_rows_per_sheet} filas de datos"
            )


def extract_metadata(path: Path) -> list[dict]:
    sheets = _run(_metadata_worker, (str(path),), settings.parse_timeout_s)
    _check_limits(sheets)
    return sheets


def read_rows(path: Path, sheet: str, offset: int, limit: int) -> dict:
    return _run(
        _rows_worker,
        (str(path), sheet, offset, limit),
        settings.parse_timeout_s,
    )


# ------------------------------------------------------------------ export

_EXPORT_CELL_LIMIT = 32_767


def _export_scalar(value: Any) -> Any:
    if value is None or isinstance(value, (int, float, bool)):
        return value
    text = value if isinstance(value, str) else str(value)
    return text[:_EXPORT_CELL_LIMIT]


def build_export(header: list[str], rows: list[list[Any]]) -> bytes:
    if not header:
        raise InvalidWorkbookError("La exportacion necesita al menos una columna")
    if len(header) > settings.max_columns:
        raise WorkbookLimitError(f"Maximo {settings.max_columns} columnas por hoja")
    if len(rows) > settings.max_rows_per_sheet:
        raise WorkbookLimitError(f"Maximo {settings.max_rows_per_sheet} filas por hoja")
    if len(rows) * len(header) > settings.max_export_cells:
        raise WorkbookLimitError(
            f"Maximo {settings.max_export_cells} celdas por exportacion"
        )
    for index, row in enumerate(rows, start=2):
        if len(row) > len(header):
            raise WorkbookLimitError(
                f"La fila {index} tiene {len(row)} valores "
                f"y la cabecera {len(header)} columnas"
            )
    workbook = Workbook()
    sheet = workbook.active
    sheet.append([_export_scalar(cell) for cell in header])
    for row in rows:
        sheet.append([_export_scalar(cell) for cell in row])
    buf = BytesIO()
    workbook.save(buf)
    return buf.getvalue()
