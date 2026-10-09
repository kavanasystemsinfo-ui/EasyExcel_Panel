"""Workbook demo publico: se siembra bajo demanda y es de solo lectura."""

import hashlib
from pathlib import Path

from app.core.config import BACKEND_DIR, settings
from app.core.storage import WorkbookStorage
from app.domain import excel_parser

DEMO_FILENAME = "easyexcel_demo.xlsx"
DEMO_ALIAS = "demo"
DEMO_ID = hashlib.sha256(b"easyexcel:demo:v1").hexdigest()[:32]


def _source() -> Path:
    return BACKEND_DIR.parent / "data" / DEMO_FILENAME


def ensure_demo() -> dict | None:
    """Crea el workbook demo si no existe y devuelve su manifest.

    Si falta data/easyexcel_demo.xlsx devuelve None (no rompe el arranque).
    Idempotente: con el manifest presente solo lee el JSON.
    """
    source = _source()
    if not source.is_file():
        return None
    storage = WorkbookStorage(settings.upload_dir)
    manifest = storage.get(DEMO_ID)
    if manifest is not None:
        return manifest
    storage.save_book_as(DEMO_ID, source.read_bytes())
    try:
        sheets: list[dict] = excel_parser.extract_metadata(storage.book_path(DEMO_ID))
    except Exception:
        storage.delete(DEMO_ID)
        raise
    return storage.finalize(DEMO_ID, DEMO_FILENAME, sheets)
