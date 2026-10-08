import re
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, File, Query, Response, UploadFile

from ..schemas import ExportPayload, SheetRows, WorkbookListItem, WorkbookOut
from backend.app.core.config import settings
from backend.app.core.demo import DEMO_ALIAS, DEMO_ID, ensure_demo
from backend.app.core.storage import WorkbookStorage
from backend.app.domain import excel_parser
from ..errors import (
    InvalidWorkbookError,
    WorkbookNotFoundError,
    WorkbookTooLargeError,
)

router = APIRouter(prefix="/api/v1/workbooks", tags=["workbooks"])

ZIP_MAGIC = b"PK\x03\x04"
XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _attachment(filename: str) -> str:
    clean = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", filename)
    fallback = clean.encode("ascii", "replace").decode("ascii")
    return f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quote(clean)}'


def _storage() -> WorkbookStorage:
    return WorkbookStorage(settings.upload_dir)


def _get_manifest(workbook_id: str) -> dict:
    manifest = _storage().get(_resolve_id(workbook_id))
    if manifest is None:
        raise WorkbookNotFoundError(f"El libro '{workbook_id}' no existe")
    return manifest


def _resolve_id(workbook_id: str) -> str:
    if workbook_id != DEMO_ALIAS:
        return workbook_id
    if ensure_demo() is None:
        raise WorkbookNotFoundError(
            "El libro demo no esta disponible: falta data/easyexcel_demo.xlsx"
        )
    return DEMO_ID


@router.post("", response_model=WorkbookOut, status_code=201)
async def upload_workbook(
    file: Annotated[UploadFile, File(...)],
) -> dict:
    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise InvalidWorkbookError("Solo se admiten archivos .xlsx")
    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise WorkbookTooLargeError(f"El archivo supera {settings.max_upload_mb} MB")
    if data[:4] != ZIP_MAGIC:
        raise InvalidWorkbookError("El contenido no es un .xlsx valido")
    storage = _storage()
    workbook_id = storage.save_book(data)
    try:
        sheets: list[dict] = excel_parser.extract_metadata(storage.book_path(workbook_id))
    except Exception:
        storage.delete(workbook_id)
        raise
    return storage.finalize(workbook_id, filename, sheets)


@router.get("", response_model=list[WorkbookListItem])
def list_workbooks() -> list[dict]:
    return _storage().list()


@router.get("/demo", response_model=WorkbookOut)
def get_demo() -> dict:
    return _get_manifest(DEMO_ALIAS)


@router.get("/{workbook_id}", response_model=WorkbookOut)
def get_workbook(workbook_id: str) -> dict:
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
    payload = excel_parser.read_rows(
        _storage().book_path(manifest["id"]), sheet_name, offset, limit
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
    manifest = _get_manifest(workbook_id)
    sheet_names = {sheet["name"] for sheet in manifest.get("sheets", [])}
    if sheet_name not in sheet_names:
        raise WorkbookNotFoundError(f"La hoja '{sheet_name}' no existe")
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
