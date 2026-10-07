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

    # Copiloto IA: proveedores conmutables de modelos gratuitos (ADR-0002)
    openrouter_api_key: str = ""
    openrouter_models: str = "inclusionai/ling-3.1-flash,cohere/north-mini-code:free"
    nvidia_api_key: str = ""
    nvidia_models: str = "google/gemma-4-31b-it"
    copiloto_max_tokens: int = 600
    copiloto_timeout_s: float = 90.0
    copiloto_rate_limit: int = 40
    copiloto_rate_window_s: int = 600
    copiloto_cache_size: int = 200
    copiloto_context_max_chars: int = 60_000


settings = Settings()
