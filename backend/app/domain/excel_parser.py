"""Lectura de Excel con timeout (ADR-0001). Compatible con serverless (sin multiprocessing).

Formatos de entrada: .xlsx (openpyxl), .xls (xlrd), .ods (odfpy), .csv (stdlib).
La exportación siempre genera .xlsx.

Detección de cabecera (ADR-0009): la fila 1 NO se asume cabecera. Se busca la
primera fila con >=2 celdas de texto distintas seguida de filas con datos,
tras saltar filas vacías y filas-título (una sola celda con texto). La
cabecera se devuelve como `header_row` (1-based, en la hoja original) en los
metadatos. Columnas con cabecera vacía se llaman "Columna N"; duplicados se
sufijan " (2)", " (3)".

Celdas combinadas: se rellena el valor de la celda ancla hacia abajo y a la
derecha (xlsx: ws.merged_cells; xls: sheet.merged_cells con
formatting_info=True; ods: numbercolumnsspanned/numberrowsspanned).

Límites con aviso (truncada): si una hoja supera max_columns o
max_rows_per_sheet se carga hasta el límite y se marca
`truncada: "columnas"|"filas"` en los metadatos en vez de rechazar el libro.
Solo se rechaza el libro entero si supera max_sheets o el tamaño máximo de
subida (éste último se controla en la capa HTTP).

Rendimiento (xlsx): la detección de cabecera y el relleno de celdas
combinadas necesitan leer valores y rangos combinados, así que se abandona
read_only=True. El coste es proporcional al tamaño real de la hoja y lo acota
el timeout `parse_timeout_s` (SIGALRM). En archivos grandes esto sube memoria
frente a read_only, pero es el precio de localizar la tabla real; el timeout
evita que el servicio se cuelgue.
"""

import csv as csv_mod
import re
import signal
import sys
from datetime import date, datetime
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any

import xlrd
from odf import table as odf_table
from odf import teletype
from odf.opendocument import load as ods_load
from openpyxl import Workbook, load_workbook
from openpyxl.utils import range_boundaries

from app.core.config import settings
from app.errors import (
    InvalidWorkbookError,
    WorkbookLimitError,
    WorkbookNotFoundError,
    WorkbookParseTimeoutError,
)

FORMATOS_IMPORT = ("xlsx", "xls", "ods", "csv")

# Filas iniciales que se inspeccionan como máximo para localizar la cabecera.
_MAX_HEADER_SCAN = 50


class TimeoutError(Exception):
    """Timeout personalizado para el parser."""


def _timeout_handler(signum, frame):
    raise TimeoutError("Timeout")


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


def _is_blank_row(row: list[Any]) -> bool:
    for c in row:
        v = _cell(c)
        if v not in ("", None):
            return False
    return True


def _row_text_cells(row: list[Any]) -> list[str]:
    """Texto normalizado (strip) de las celdas de texto no vacías."""
    out: list[str] = []
    for c in row:
        v = _cell(c)
        if isinstance(v, str) and v.strip():
            out.append(v.strip())
    return out


def _detect_header_row(rows: list[list[Any]]) -> int:
    """Índice (0-based) de la fila de cabecera dentro de `rows`.

    Estrategia: saltar filas vacías y filas-título (0 o 1 celdas de texto);
    también saltar filas duplicadas que parecen venir de celdas combinadas
    (mismo contenido en ≥2 celdas que la fila anterior O la siguiente).
    La primera fila con >=2 celdas de texto distintas seguida de al menos una
    fila con datos se considera cabecera. Si nada encaja, devuelve 0 (fila 1).
    """
    if not rows:
        return 0
    limite = min(len(rows), _MAX_HEADER_SCAN)
    for idx in range(limite):
        row = rows[idx]
        if _is_blank_row(row):
            continue
        textos = _row_text_cells(row)
        # Fila-título: una sola celda con texto -> seguir buscando
        if len(textos) < 2:
            continue
        # Filas duplicadas (posibles celdas combinadas rellenadas): ignorar
        # Comprobar contra fila anterior
        if idx > 0 and len(textos) >= 2:
            prev_textos = _row_text_cells(rows[idx - 1])
            if textos == prev_textos and len(textos) == len(prev_textos):
                continue
        # Comprobar contra fila siguiente (merged cells propagan hacia abajo)
        if idx + 1 < len(rows):
            next_textos = _row_text_cells(rows[idx + 1])
            if textos == next_textos and len(textos) == len(next_textos):
                continue
        # ¿Hay filas con datos después?
        hay_datos = False
        for j in range(idx + 1, min(len(rows), idx + 5)):
            if not _is_blank_row(rows[j]):
                hay_datos = True
                break
        if hay_datos:
            return idx
    return 0


def _normalize_header(header_raw: list[Any], total_cols: int) -> list[str]:
    """Nombres finales de cabecera: vacíos -> "Columna N", duplicados -> " (2)"."""
    nombres: list[str] = []
    vistos: dict[str, int] = {}
    for i in range(total_cols):
        raw = header_raw[i] if i < len(header_raw) else ""
        nombre = str(raw).strip() if raw is not None else ""
        if not nombre:
            nombre = f"Columna {i + 1}"
        key = nombre.lower()
        if key in vistos:
            vistos[key] += 1
            nombre = f"{nombre} ({vistos[key]})"
        else:
            vistos[key] = 1
        nombres.append(nombre)
    return nombres


# --------------------------------------------------- formatos no xlsx
#
# El storage guarda siempre book.xlsx, asi que el formato se detecta por
# magic bytes y el nombre de la hoja del csv viene del nombre original.


OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _detect_format(path: str) -> str:
    import zipfile

    with open(path, "rb") as fh:
        head = fh.read(8)
    if head.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(path) as archive:
                if "mimetype" in archive.namelist():
                    if b"opendocument.spreadsheet" in archive.read("mimetype"):
                        return "ods"
        except zipfile.BadZipFile:
            pass
        return "xlsx"
    if head.startswith(OLE2_MAGIC):
        return "xls"
    return "csv"


def _csv_number(valor: str, coma_decimal: bool) -> Any:
    texto = valor.strip()
    if not texto:
        return ""
    if re.fullmatch(r"-?\d+", texto):
        return int(texto)
    if coma_decimal and re.fullmatch(r"-?\d+,\d+", texto):
        return float(texto.replace(",", "."))
    if re.fullmatch(r"-?\d+\.\d+", texto):
        return float(texto)
    return valor


def _load_csv(path: str, nombre: str | None) -> list[dict]:
    data = Path(path).read_bytes()
    texto: str | None = None
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            texto = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if texto is None:
        texto = data.decode("latin-1", errors="replace")
    primera = next((linea for linea in texto.splitlines() if linea.strip()), "")
    delimitador = max((";", ",", "\t"), key=primera.count)
    coma_decimal = delimitador != ","
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    max_cols = settings.max_columns
    filas: list[list[Any]] = []
    truncada_cols = False
    for fila in csv_mod.reader(StringIO(texto), delimiter=delimitador):
        if len(fila) > max_cols:
            truncada_cols = True
        filas.append([_csv_number(c, coma_decimal) for c in fila[:max_cols]])
        if len(filas) >= max_filas:
            break
    hoja = Path(nombre).stem if nombre else "libro"
    return [
        {
            "name": hoja or "libro",
            "rows": filas,
            "truncada": "columnas" if truncada_cols else None,
        }
    ]


def _load_xls(path: str) -> list[dict]:
    # formatting_info=True habilita sheet.merged_cells (rangos (rlo,rhi,clo,chi)).
    # Coste: algo más de memoria por hoja; lo acota el timeout del parser.
    try:
        book = xlrd.open_workbook(path, formatting_info=True)
    except Exception:
        book = xlrd.open_workbook(path)
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    max_cols = settings.max_columns
    sheets: list[dict] = []
    for sh in book.sheets():
        merged = getattr(sh, "merged_cells", []) or []
        filas: list[list[Any]] = []
        truncada_cols = sh.ncols > max_cols
        for r in range(min(sh.nrows, max_filas)):
            fila: list[Any] = []
            for c in range(min(sh.ncols, max_cols)):
                cell = sh.cell(r, c)
                if cell.ctype == xlrd.XL_CELL_DATE:
                    dt = xlrd.xldate.xldate_as_datetime(cell.value, book.datemode)
                    fila.append(dt.isoformat())
                elif cell.ctype == xlrd.XL_CELL_NUMBER:
                    value = cell.value
                    fila.append(int(value) if value == int(value) else value)
                elif cell.ctype == xlrd.XL_CELL_BOOLEAN:
                    fila.append(bool(cell.value))
                elif cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
                    fila.append("")
                else:
                    fila.append(str(cell.value))
            filas.append(fila)
        # Rellenar celdas combinadas: propagar el ancla dentro del rango,
        # limitado a las filas cargadas y a max_cols.
        for rlo, rhi, clo, chi in merged:
            if rlo >= len(filas) or clo >= max_cols:
                continue
            valor = filas[rlo][clo] if len(filas[rlo]) > clo else ""
            if valor in ("", None):
                continue
            for rr in range(rlo, min(rhi, len(filas))):
                for cc in range(clo, min(chi, max_cols)):
                    if rr == rlo and cc == clo:
                        continue
                    filas[rr][cc] = valor
        sheets.append(
            {
                "name": sh.name,
                "rows": filas,
                "truncada": "columnas" if truncada_cols else None,
            }
        )
    return sheets


def _ods_cell_value(node) -> Any:
    # odfpy expone las "clases" como factories: distinguir por qname.
    if node.qname[1] == "covered-table-cell":
        return ""
    valuetype = node.getAttribute("valuetype")
    if valuetype in ("float", "percentage", "currency"):
        raw = node.getAttribute("value")
        try:
            number = float(raw)
            return int(number) if number == int(number) else number
        except (TypeError, ValueError):
            return teletype.extractText(node)
    if valuetype == "boolean":
        return node.getAttribute("booleanvalue") == "true"
    if valuetype == "date":
        return node.getAttribute("datevalue") or teletype.extractText(node)
    return teletype.extractText(node)


def _load_ods(path: str) -> list[dict]:
    doc = ods_load(path)
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    max_cols = settings.max_columns
    sheets: list[dict] = []
    for tbl in doc.spreadsheet.getElementsByType(odf_table.Table):
        name = tbl.getAttribute("name") or "Hoja"
        filas: list[list[Any]] = []
        truncada_cols = False
        # Spans verticales pendientes de propagar: {col: (valor, filas_restantes)}
        rowspan_activos: dict[int, tuple[Any, int]] = {}
        for row in tbl.getElementsByType(odf_table.TableRow):
            repeticiones = int(row.getAttribute("numberrowsrepeated") or 1)
            celdas: list[Any] = []
            col_idx = 0
            for node in row.childNodes:
                qname = getattr(node, "qname", None)
                if qname is None or qname[1] not in ("table-cell", "covered-table-cell"):
                    continue
                repeat = int(node.getAttribute("numbercolumnsrepeated") or 1)
                rowspan = int(node.getAttribute("numberrowsspanned") or 1)
                value = _ods_cell_value(node)
                efectivas = min(repeat, max_cols - col_idx)
                if efectivas <= 0:
                    truncada_cols = True
                    break
                if repeat > efectivas:
                    truncada_cols = True
                for offset in range(efectivas):
                    celdas.append(value)
                    if rowspan > 1:
                        rowspan_activos[col_idx + offset] = (value, rowspan - 1)
                col_idx += efectivas
            # LibreOffice rellena el final con filas vacias repetidas:
            # no materializar ese padding (dispararia falsos limites).
            if repeticiones > 1 and all(c == "" for c in celdas):
                continue
            for _ in range(min(repeticiones, max_filas - len(filas))):
                # Aplicar rowspans activos sobre la fila que se va a añadir
                fila_vals = list(celdas)
                for col, (valor, restantes) in list(rowspan_activos.items()):
                    if restantes > 0 and col < len(fila_vals):
                        fila_vals[col] = valor
                filas.append(fila_vals)
                # Decrementar rowspans
                for col, (valor, restantes) in list(rowspan_activos.items()):
                    if restantes > 0:
                        rowspan_activos[col] = (valor, restantes - 1)
                    else:
                        del rowspan_activos[col]
            if len(filas) >= max_filas:
                break
        sheets.append(
            {
                "name": name,
                "rows": filas,
                "truncada": "columnas" if truncada_cols else None,
            }
        )
    return sheets


def _load_sheets(path: str, fmt: str, nombre: str | None) -> list[dict]:
    if fmt == "csv":
        return _load_csv(path, nombre)
    if fmt == "xls":
        return _load_xls(path)
    if fmt == "ods":
        return _load_ods(path)
    raise InvalidWorkbookError(f"Formato no soportado: .{fmt}")


def _metadata_from_rows(sheets: list[dict]) -> list[dict]:
    out: list[dict] = []
    for sheet in sheets:
        rows = sheet["rows"]
        cols = max((_width(tuple(r)) for r in rows), default=0)
        cols = min(cols, settings.max_columns)
        hdr_idx = _detect_header_row(rows)
        data_rows = max(len(rows) - hdr_idx - 1, 0)
        truncada = sheet.get("truncada")
        if not truncada and data_rows > settings.max_rows_per_sheet:
            truncada = "filas"
        out.append(
            {
                "name": sheet["name"],
                "rows": min(data_rows, settings.max_rows_per_sheet),
                "cols": cols,
                "header_row": hdr_idx + 1,
                "truncada": truncada,
            }
        )
    return out


def _read_rows_from_sheets(
    sheets: list[dict], sheet: str, offset: int, limit: int
) -> dict:
    match = next((s for s in sheets if s["name"] == sheet), None)
    if match is None:
        raise WorkbookNotFoundError(f"La hoja '{sheet}' no existe")
    rows = match["rows"]
    hdr_idx = _detect_header_row(rows)
    header_raw = rows[hdr_idx] if rows else []
    cols = max((_width(tuple(r)) for r in rows), default=0)
    cols = min(cols, settings.max_columns)
    ancho = max(cols, _width(tuple(header_raw)))
    header = _normalize_header([_cell(v) for v in header_raw], ancho)
    data = rows[hdr_idx + 1 :]
    if len(data) > settings.max_rows_per_sheet:
        data = data[: settings.max_rows_per_sheet]
    page = [[_cell(value) for value in row[:ancho]] for row in data[offset : offset + limit]]
    return {"header": header, "rows": page, "total": len(data)}


# ------------------------------------------------------------------ xlsx


def _xlsx_sheet_rows(
    ws, max_filas: int, max_cols: int
) -> tuple[list[list[Any]], str | None]:
    """Lee filas de una hoja xlsx (modo normal, no read_only) con relleno de merged cells.

    Devuelve (filas, truncada_columnas). El modo no-read_only es necesario
    para acceder a ws.merged_cells; el coste se documenta en el docstring del
    módulo y lo acota el timeout del parser.
    """
    # Usar límites reales de la hoja, no los de configuración, para evitar
    # iterar sobre celdas vacías innecesarias (en modo no-read_only es muy lento).
    real_max_row = ws.max_row or 0
    real_max_col = ws.max_column or 0
    read_max_row = min(max_filas, real_max_row)
    read_max_col = min(max_cols, real_max_col)
    truncada_cols = bool(real_max_col > max_cols)
    truncada_rows = bool(real_max_row > max_filas)
    filas: list[list[Any]] = []
    for row in ws.iter_rows(
        min_row=1, max_row=read_max_row, max_col=read_max_col, values_only=True
    ):
        filas.append(list(row))
    # Rellenar merged cells: propagar el valor del ancla (esquina superior
    # izquierda) hacia abajo y a la derecha, dentro de los límites cargados.
    for merged in ws.merged_cells.ranges:
        min_col, min_row, max_col_r, max_row_r = range_boundaries(str(merged))
        if min_row > len(filas) or min_col > max_cols:
            continue
        anchor_row = filas[min_row - 1]
        if len(anchor_row) < min_col:
            continue
        anchor_val = anchor_row[min_col - 1]
        if anchor_val is None:
            continue
        for rr in range(min_row, min(max_row_r, len(filas)) + 1):
            for cc in range(min_col, min(max_col_r, max_cols) + 1):
                if rr == min_row and cc == min_col:
                    continue
                while len(filas[rr - 1]) < cc:
                    filas[rr - 1].append(None)
                filas[rr - 1][cc - 1] = anchor_val
    truncada = None
    if truncada_cols:
        truncada = "columnas"
    elif truncada_rows:
        truncada = "filas"
    return filas, truncada


def _extract_metadata_sync(path: str) -> list[dict]:
    """Extrae metadatos (detección de cabecera + merged cells; no read_only)."""
    workbook = load_workbook(path, read_only=False, data_only=True)
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    sheets: list[dict] = []
    for ws in workbook.worksheets:
        filas, truncada = _xlsx_sheet_rows(ws, max_filas, settings.max_columns)
        cols = max((_width(tuple(r)) for r in filas), default=0)
        cols = min(cols, settings.max_columns)
        hdr_idx = _detect_header_row(filas)
        data_rows = max(len(filas) - hdr_idx - 1, 0)
        if not truncada and data_rows > settings.max_rows_per_sheet:
            truncada = "filas"
        sheets.append(
            {
                "name": ws.title,
                "rows": min(data_rows, settings.max_rows_per_sheet),
                "cols": cols,
                "header_row": hdr_idx + 1,
                "truncada": truncada,
            }
        )
    workbook.close()
    return sheets


def _read_rows_sync(path: str, sheet: str, offset: int, limit: int) -> dict:
    """Lee filas con detección de cabecera y merged cells (no read_only)."""
    workbook = load_workbook(path, read_only=False, data_only=True)
    if sheet not in workbook.sheetnames:
        workbook.close()
        raise WorkbookNotFoundError(f"La hoja '{sheet}' no existe")
    ws = workbook[sheet]
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    filas, _ = _xlsx_sheet_rows(ws, max_filas, settings.max_columns)
    workbook.close()
    hdr_idx = _detect_header_row(filas)
    header_raw = filas[hdr_idx] if filas else []
    cols = max((_width(tuple(r)) for r in filas), default=0)
    cols = min(cols, settings.max_columns)
    ancho = max(cols, _width(tuple(header_raw)))
    header = _normalize_header([_cell(v) for v in header_raw], ancho)
    data = filas[hdr_idx + 1 :]
    if len(data) > settings.max_rows_per_sheet:
        data = data[: settings.max_rows_per_sheet]
    page = [[_cell(value) for value in row[:ancho]] for row in data[offset : offset + limit]]
    return {"header": header, "rows": page, "total": len(data)}


def _run_with_timeout(func, *args, timeout_s: float):
    """Ejecuta una función con timeout usando signal (solo Unix)."""
    if sys.platform == "win32":
        # Windows no tiene SIGALRM: se ejecuta sin timeout
        return func(*args)
    try:
        old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
        signal.setitimer(signal.ITIMER_REAL, timeout_s)
        try:
            result = func(*args)
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, old_handler)
        return result
    except (AttributeError, ValueError, OSError):
        # signal no disponible (Windows, o entorno restringido) -> sin timeout
        return func(*args)
    except TimeoutError as exc:
        raise WorkbookParseTimeoutError(
            "El archivo es demasiado grande para analizarlo, "
            "prueba a quitar columnas o hojas"
        ) from exc


def _check_limits(sheets: list[dict]) -> None:
    """Límite duro del LIBRO: nº de hojas. Las hojas anchas/largas se truncan
    con aviso (`truncada`) en vez de rechazarse (ADR-0009)."""
    if len(sheets) > settings.max_sheets:
        raise WorkbookLimitError(f"Maximo {settings.max_sheets} hojas por libro")


def _extract_metadata_generic(path: str, fmt: str, nombre: str | None) -> list[dict]:
    return _metadata_from_rows(_load_sheets(path, fmt, nombre))


def _read_rows_generic(
    path: str, fmt: str, nombre: str | None, sheet: str, offset: int, limit: int
) -> dict:
    return _read_rows_from_sheets(_load_sheets(path, fmt, nombre), sheet, offset, limit)


def extract_metadata(path: Path, nombre: str | None = None) -> list[dict]:
    fmt = _detect_format(str(path))
    if fmt == "xlsx":
        sheets = _run_with_timeout(
            _extract_metadata_sync, str(path), timeout_s=settings.parse_timeout_s
        )
    else:
        sheets = _run_with_timeout(
            _extract_metadata_generic,
            str(path), fmt, nombre,
            timeout_s=settings.parse_timeout_s,
        )
    _check_limits(sheets)
    return sheets


def read_rows(
    path: Path, sheet: str, offset: int, limit: int, nombre: str | None = None
) -> dict:
    fmt = _detect_format(str(path))
    if fmt == "xlsx":
        return _run_with_timeout(
            _read_rows_sync,
            str(path), sheet, offset, limit,
            timeout_s=settings.parse_timeout_s,
        )
    return _run_with_timeout(
        _read_rows_generic,
        str(path), fmt, nombre, sheet, offset, limit,
        timeout_s=settings.parse_timeout_s,
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