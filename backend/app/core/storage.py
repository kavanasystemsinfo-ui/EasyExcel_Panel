import json
import re
import shutil
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

_ID_RE = re.compile(r"^[0-9a-f]{32}$")


class WorkbookStorage:
    """Persistencia en filesystem: un directorio por workbook (UUID) con
    `book.xlsx` y `manifest.json`. Sin copias duplicadas del archivo.

    Las subidas son efimeras: `purge_expired` borra las que superan el TTL
    (lo ejecuta una tarea periodica y las rutas de subida/lectura).
    """

    def __init__(self, root: Path):
        self.root = Path(root)

    @staticmethod
    def valid_id(wb_id: str) -> bool:
        return bool(_ID_RE.match(wb_id))

    def _dir(self, wb_id: str) -> Path:
        return self.root / wb_id

    def book_path(self, wb_id: str) -> Path:
        return self._dir(wb_id) / "book.xlsx"

    def save_book(self, data: bytes) -> str:
        wb_id = uuid.uuid4().hex
        self._dir(wb_id).mkdir(parents=True, exist_ok=True)
        self.book_path(wb_id).write_bytes(data)
        return wb_id

    def save_book_as(self, wb_id: str, data: bytes) -> None:
        if not self.valid_id(wb_id):
            raise ValueError(f"Id no valido: {wb_id!r}")
        self._dir(wb_id).mkdir(parents=True, exist_ok=True)
        self.book_path(wb_id).write_bytes(data)

    def finalize(
        self,
        wb_id: str,
        filename: str,
        sheets: list[dict],
        extra: dict | None = None,
    ) -> dict:
        manifest = {
            "id": wb_id,
            "filename": filename,
            "uploaded_at": datetime.now(UTC).isoformat(),
            "sheets": sheets,
        }
        if extra:
            manifest.update(extra)
        manifest_path = self._dir(wb_id) / "manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
        )
        return manifest

    def get(self, wb_id: str) -> dict | None:
        if not self.valid_id(wb_id):
            return None
        manifest_path = self._dir(wb_id) / "manifest.json"
        if not manifest_path.is_file():
            return None
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        return manifest if isinstance(manifest, dict) else None

    def _ensure_book_exists(self, wb_id: str) -> Path:
        """Devuelve la ruta de book.xlsx; FileNotFoundError si no existe."""
        book_path = self.book_path(wb_id)
        if book_path.is_file():
            return book_path
        raise FileNotFoundError(f"No se pudo recuperar el libro {wb_id}")

    def list(self) -> list[dict]:
        if not self.root.is_dir():
            return []
        manifests = []
        for child in self.root.iterdir():
            if child.is_dir() and self.valid_id(child.name):
                manifest = self.get(child.name)
                if manifest is not None:
                    manifests.append(manifest)
        manifests.sort(key=lambda m: str(m.get("uploaded_at", "")), reverse=True)
        return manifests

    def delete(self, wb_id: str) -> bool:
        if not self.valid_id(wb_id):
            return False
        target = self._dir(wb_id)
        if not target.is_dir():
            return False
        shutil.rmtree(target)
        return True

    def purge_expired(
        self, ttl_hours: float, exclude: set[str] | None = None
    ) -> int:
        """Borra workbooks con uploaded_at mas antiguo que ttl_hours.

        Los ids de `exclude` (el demo) nunca se tocan. Un directorio sin
        manifest legible (subida interrumpida) caduca por su mtime.
        Devuelve el numero de directorios borrados.
        """
        if ttl_hours <= 0 or not self.root.is_dir():
            return 0
        exclude = exclude or set()
        cutoff = datetime.now(UTC) - timedelta(hours=ttl_hours)
        removed = 0
        for child in list(self.root.iterdir()):
            if not child.is_dir() or not self.valid_id(child.name):
                continue
            if child.name in exclude:
                continue
            manifest = self.get(child.name)
            uploaded: datetime | None = None
            if manifest is not None:
                try:
                    uploaded = datetime.fromisoformat(
                        str(manifest.get("uploaded_at", ""))
                    )
                except ValueError:
                    uploaded = None
                if uploaded is not None and uploaded.tzinfo is None:
                    uploaded = uploaded.replace(tzinfo=UTC)
            if uploaded is None:
                # Sin manifest o fecha ilegible: caducar por mtime del dir.
                try:
                    uploaded = datetime.fromtimestamp(
                        child.stat().st_mtime, UTC
                    )
                except OSError:
                    continue
            if uploaded >= cutoff:
                continue
            shutil.rmtree(child, ignore_errors=True)
            removed += 1
        return removed
