import re
from pathlib import Path
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, File, Query, Response, UploadFile

from app.core.config import settings
from app.core.demo import DEMO_ALIAS, DEMO_ID, ensure_demo
from app.core.storage import WorkbookStorage
from app.domain import excel_parser

from ...errors import (
    InvalidWorkbookError,
    WorkbookNotFoundError,
    WorkbookTooLargeError,
)
from ..schemas import ExportPayload, SheetRows, WorkbookListItem, WorkbookOut

router = APIRouter(prefix="/api/v1/workbooks", tags=["workbooks"])

ZIP_MAGIC = b"PK\x03\x04"
OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
EXTENSIONES = {".xlsx", ".xls", ".ods", ".csv"}
XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _attachment(filename: str) -> str:
    clean = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", filename)
    fallback = clean.encode("ascii", "replace").decode("ascii")
    return f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quote(clean)}'


def _storage() -> WorkbookStorage:
    return WorkbookStorage(settings.upload_dir)


def _purge() -> None:
    """Caducidad de subidas (efimero): nunca toca el demo."""
    _storage().purge_expired(settings.upload_ttl_hours, exclude={DEMO_ID})


def _get_manifest(workbook_id: str) -> dict:
    manifest = _storage().get(_resolve_id(workbook_id))
    if manifest is None:
        raise WorkbookNotFoundError(f"El libro '{workbook_id}' no existe")
    return manifest


def _resolve_id(workbook_id: str) -> str:
    if workbook_id != DEMO_ALIAS and workbook_id != DEMO_ID:
        return workbook_id
    if ensure_demo() is None:
        raise WorkbookNotFoundError(
            "El libro demo no esta disponible: falta data/easyexcel_demo.xlsx"
        )
    return DEMO_ID


@router.post("", status_code=201)
async def upload_workbook(
    file: Annotated[UploadFile, File(...)],
) -> dict:
    """Sube un .xlsx y devuelve el libro completo (metadatos + filas).

    Devuelve las filas en la misma respuesta del upload: una sola petición
    para el cliente y una sola pasada de validación en el servidor.
    """
    filename = file.filename or ""
    if Path(filename).suffix.lower() not in EXTENSIONES:
        raise InvalidWorkbookError(
            "Formatos admitidos: .xlsx, .xls, .ods o .csv"
        )
    max_bytes = settings.max_upload_mb * 1024 * 1024
    trozos: list[bytes] = []
    total = 0
    while True:
        trozo = await file.read(1024 * 1024)
        if not trozo:
            break
        total += len(trozo)
        if total > max_bytes:
            # Corta en el primer MB que desborda: nunca se materializa
            # el body completo en memoria antes de rechazarlo.
            raise WorkbookTooLargeError(f"El archivo supera {settings.max_upload_mb} MB")
        trozos.append(trozo)
    data = b"".join(trozos)
    ext = Path(filename).suffix.lower()
    if ext in {".xlsx", ".ods"}:
        if data[:4] != ZIP_MAGIC:
            raise InvalidWorkbookError(f"El contenido no es un {ext} valido")
    elif ext == ".xls":
        if data[:8] != OLE2_MAGIC:
            raise InvalidWorkbookError("El contenido no es un .xls valido")
    elif b"\x00" in data[:8192]:
        raise InvalidWorkbookError("El contenido no es un .csv valido")
    storage = _storage()
    storage.purge_expired(settings.upload_ttl_hours, exclude={DEMO_ID})
    workbook_id = storage.save_book(data)
    try:
        book_path = storage.book_path(workbook_id)
        sheets_meta: list[dict] = excel_parser.extract_metadata(book_path, filename)
        sheets_full: list[dict] = []
        for s in sheets_meta:
            payload = excel_parser.read_rows(
                book_path, s["name"], 0, s["rows"] or 1, filename
            )
            sheets_full.append(
                {
                    "name": s["name"],
                    "rows": s["rows"],
                    "cols": s["cols"],
                    "header": payload.get("header", []),
                    "data": payload.get("rows", []),
                }
            )
    except Exception:
        storage.delete(workbook_id)
        raise
    manifest = storage.finalize(workbook_id, filename, sheets_meta)
    return {**manifest, "sheets": sheets_full}


@router.get("", response_model=list[WorkbookListItem])
def list_workbooks() -> list[dict]:
    _purge()
    return _storage().list()


@router.get("/demo", response_model=WorkbookOut)
def get_demo() -> dict:
    _purge()
    return _get_manifest(DEMO_ALIAS)


@router.get("/{workbook_id}", response_model=WorkbookOut)
def get_workbook(workbook_id: str) -> dict:
    _purge()
    return _get_manifest(workbook_id)


@router.get("/{workbook_id}/sheets/{sheet_name}/rows", response_model=SheetRows)
def get_sheet_rows(
    workbook_id: str,
    sheet_name: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> dict:
    manifest = _get_manifest(workbook_id)
    sheet_names = {sheet["name"] for sheet in manifest.get("sheets", [])}
    if sheet_name not in sheet_names:
        raise WorkbookNotFoundError(f"La hoja '{sheet_name}' no existe")
    storage = _storage()
    book_path = storage._ensure_book_exists(manifest["id"])
    payload = excel_parser.read_rows(
        book_path, sheet_name, offset, limit, manifest.get("filename")
    )
    return {
        "sheet": sheet_name,
        "offset": offset,
        "limit": limit,
        **payload,
    }


@router.post("/{workbook_id}/sheets/{sheet_name}/export")
def export_sheet(
    workbook_id: str,
    sheet_name: str,
    payload: ExportPayload,
) -> Response:
    _purge()
    manifest = _get_manifest(workbook_id)
    sheet_names = {sheet["name"] for sheet in manifest.get("sheets", [])}
    if sheet_name not in sheet_names:
        raise WorkbookNotFoundError(f"La hoja '{sheet_name}' no existe")
    storage = _storage()
    storage._ensure_book_exists(manifest["id"])
    content = excel_parser.build_export(payload.header, payload.rows)
    stem = str(manifest.get("filename", "libro")).rsplit(".", 1)[0] or "libro"
    name = re.sub(r'[\\/:*?"<>|]', "_", f"{stem}_{sheet_name}.xlsx")
    return Response(
        content=content,
        media_type=XLSX_MEDIA,
        headers={"Content-Disposition": _attachment(name)},
    )


@router.delete("/{workbook_id}", status_code=204)
def delete_workbook(workbook_id: str) -> None:
    if workbook_id in {DEMO_ALIAS, DEMO_ID}:
        raise InvalidWorkbookError("El libro demo es de solo lectura")
    if not _storage().delete(workbook_id):
        raise WorkbookNotFoundError(f"El libro '{workbook_id}' no existe")
