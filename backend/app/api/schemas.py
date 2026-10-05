from datetime import datetime

from pydantic import BaseModel, Field


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
