from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="EASYEXCEL_")

    app_name: str = "easyexcel-backend"
    version: str = "0.1.0"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Limites de seguridad para la carga de Excel (ADR-0001)
    max_upload_mb: int = 10
    max_sheets: int = 50
    max_columns: int = 200
    max_rows_per_sheet: int = 100_000
    max_export_cells: int = 2_000_000
    parse_timeout_s: float = 5.0
    upload_dir: Path = BACKEND_DIR / "data" / "uploads"


settings = Settings()
