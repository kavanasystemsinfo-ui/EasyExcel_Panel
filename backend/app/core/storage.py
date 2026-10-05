import json
import re
import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path

_ID_RE = re.compile(r"^[0-9a-f]{32}$")


class WorkbookStorage:
    """Persistencia en filesystem: un UUID por workbook con su manifest."""

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

    def finalize(self, wb_id: str, filename: str, sheets: list[dict]) -> dict:
        manifest = {
            "id": wb_id,
            "filename": filename,
            "uploaded_at": datetime.now(UTC).isoformat(),
            "sheets": sheets,
        }
        manifest_path = self._dir(wb_id) / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
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
