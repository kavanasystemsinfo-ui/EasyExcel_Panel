from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile

from app.api.schemas import SheetRows, WorkbookListItem, WorkbookOut
from app.core.config import settings
from app.core.storage import WorkbookStorage
from app.domain import excel_parser
from app.errors import (
    InvalidWorkbookError,
    WorkbookNotFoundError,
    WorkbookTooLargeError,
)

router = APIRouter(prefix="/api/v1/workbooks", tags=["workbooks"])

ZIP_MAGIC = b"PK\x03\x04"


def _storage() -> WorkbookStorage:
    return WorkbookStorage(settings.upload_dir)


def _get_manifest(workbook_id: str) -> dict:
    manifest = _storage().get(workbook_id)
    if manifest is None:
        raise WorkbookNotFoundError(f"El libro '{workbook_id}' no existe")
    return manifest


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
    payload = excel_parser.read_rows(_storage().book_path(workbook_id), sheet_name, offset, limit)
    return {
        "sheet": sheet_name,
        "offset": offset,
        "limit": limit,
        **payload,
    }


@router.delete("/{workbook_id}", status_code=204)
def delete_workbook(workbook_id: str) -> None:
    if not _storage().delete(workbook_id):
        raise WorkbookNotFoundError(f"El libro '{workbook_id}' no existe")
