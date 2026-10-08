import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from ..core.config import settings


class SheetInfo(BaseModel):
    name: str
    rows: int = Field(description="Filas de datos (sin la cabecera de la fila 1)")
    cols: int


class WorkbookListItem(BaseModel):
    id: str
    filename: str
    uploaded_at: datetime


class WorkbookOut(WorkbookListItem):
    sheets: list[SheetInfo]


class SheetRows(BaseModel):
    sheet: str
    header: list[str]
    rows: list[list[object]]
    total: int = Field(description="Filas de datos disponibles (sin la cabecera)")
    offset: int
    limit: int


class ExportPayload(BaseModel):
    header: list[str]
    rows: list[list[str | int | float | bool | None]]


class CopilotoPayload(BaseModel):
    pregunta: str = Field(min_length=1, max_length=2000)
    contexto: dict[str, Any] = Field(default_factory=dict)

    @field_validator("contexto")
    @classmethod
    def _limitar_contexto(cls, valor: dict[str, Any]) -> dict[str, Any]:
        blob = json.dumps(valor, ensure_ascii=False)
        if len(blob) > settings.copiloto_context_max_chars:
            raise ValueError("contexto demasiado grande (maximo 60000 caracteres)")
        return valor
