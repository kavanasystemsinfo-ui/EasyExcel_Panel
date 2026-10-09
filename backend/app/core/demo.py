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
    # En Vercel: BACKEND_DIR = /var/task/_vendor/backend/app -> /var/task/_vendor/backend/data
    #           O también podría estar en /var/task/backend/data (fuera del vendor)
    # En local: BACKEND_DIR = /root/EasyExcel_Panel/backend/app -> /root/EasyExcel_Panel/backend/data
    path1 = BACKEND_DIR / "data" / DEMO_FILENAME
    if path1.is_file():
        return path1
    # Fallback: buscar en el directorio padre (estructura local original)
    path2 = BACKEND_DIR.parent / "data" / DEMO_FILENAME
    if path2.is_file():
        return path2
    # En Vercel: fuera del vendor
    path3 = Path("/var/task/backend/data") / DEMO_FILENAME
    if path3.is_file():
        return path3
    # En Vercel: dentro del vendor
    path4 = Path("/var/task/_vendor/backend/data") / DEMO_FILENAME
    if path4.is_file():
        return path4
    return path1  # devuelve el primero para que falle con mensaje claro


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
