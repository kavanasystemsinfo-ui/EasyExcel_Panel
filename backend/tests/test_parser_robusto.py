"""Tests sintéticos para el parser robusto (ADR-0009).

6 Excels generados por código que cubren:
1. Título + filas vacías antes de la tabla
2. Tabla que empieza en C5 (offset fila/columna)
3. Celdas combinadas (merged cells)
4. Cabeceras duplicadas y vacías
5. Hoja ancha (250 columnas) -> truncada: columnas
6. CSV con delimitador ';'
"""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.core.config import settings
from app.main import app

CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def make_xlsx(sheets: dict[str, list[list[object]]]) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=name)
        for row in rows:
            ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def upload(client: TestClient, data: bytes, filename: str = "test.xlsx") -> dict:
    resp = client.post(
        "/api/v1/workbooks",
        files={"file": (filename, data, CONTENT_TYPE)},
    )
    return resp


@pytest.fixture(autouse=True)
def uploads_en_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", tmp_path)


@pytest.fixture()
def client():
    return TestClient(app)


# 1. Título + filas vacías antes de la tabla
def test_parser_ignora_titulo_y_filas_vacias(client):
    """Hoja con título en fila 1, fila 2 vacía, tabla empieza en fila 3."""
    data = make_xlsx({
        "Hoja1": [
            ["Informe Mensual Ventas"],           # fila 1: título (1 celda)
            [],                                    # fila 2: vacía
            ["Producto", "Unidades", "Importe"],  # fila 3: cabecera real
            ["Sofa", 3, 450.5],
            ["Mesa", 1, 120.0],
        ]
    })
    resp = upload(client, data, "titulo_vacias.xlsx")
    assert resp.status_code == 201
    body = resp.json()
    hoja = body["sheets"][0]
    # Debe detectar fila 3 como cabecera (1-based)
    assert hoja["header_row"] == 3
    assert hoja["header"] == ["Producto", "Unidades", "Importe"]
    assert hoja["rows"] == 2
    assert hoja["data"][0] == ["Sofa", 3, 450.5]


# 2. Tabla que empieza en C5 (offset fila y columna)
def test_parser_tabla_en_c5(client):
    """Hoja con filas-título en A1:A4 (una sola celda), tabla real empieza en C5."""
    data = make_xlsx({
        "Hoja1": [
            ["Título del informe"],          # fila 1: título (1 celda)
            ["Subtítulo"],                   # fila 2: título (1 celda)
            ["Otra fila de metadatos"],      # fila 3: título (1 celda)
            ["Más metadatos"],               # fila 4: título (1 celda)
            [None, None, "Producto", "Unidades", "Importe"],  # fila 5 (C5=Producto)
            [None, None, "Sofa", 3, 450.5],
            [None, None, "Mesa", 1, 120.0],
        ]
    })
    resp = upload(client, data, "c5.xlsx")
    assert resp.status_code == 201
    body = resp.json()
    hoja = body["sheets"][0]
    # Debe detectar fila 5 como cabecera (las 1-4 son títulos de 1 celda)
    assert hoja["header_row"] == 5
    # Las columnas A y B no tienen cabecera ni datos: se descartan, no salen
    # como "Columna 1" y "Columna 2".
    assert hoja["header"] == ["Producto", "Unidades", "Importe"]
    assert hoja["rows"] == 2
    assert hoja["data"][0] == ["Sofa", 3, 450.5]


# 3. Celdas combinadas (merged cells) - xlsx
def test_parser_merged_cells_xlsx(client):
    """Celdas combinadas: A1:A3 y B1:B3 combinados con título, cabecera real en fila 4."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Merged"
    # Título combinado en filas 1-3
    ws.merge_cells("A1:A3")
    ws.merge_cells("B1:B3")
    ws["A1"] = "Informe Mensual"
    ws["B1"] = "Departamento Ventas"
    # Cabecera real en fila 4 (fuera del rango combinado)
    ws["A4"] = "Producto"
    ws["B4"] = "Valor"
    ws["A5"] = "Item 1"
    ws["B5"] = 10
    ws["A6"] = "Item 2"
    ws["B6"] = 20
    buf = BytesIO()
    wb.save(buf)
    data = buf.getvalue()

    resp = upload(client, data, "merged.xlsx")
    assert resp.status_code == 201
    body = resp.json()
    hoja = body["sheets"][0]
    # Debe detectar fila 4 como cabecera (filas 1-3 son título combinado)
    assert hoja["header_row"] == 4
    assert hoja["header"] == ["Producto", "Valor"]
    assert hoja["rows"] == 2
    assert hoja["data"][0] == ["Item 1", 10]
    assert hoja["data"][1] == ["Item 2", 20]


# 4. Cabeceras duplicadas y vacías
def test_parser_cabeceras_duplicadas_y_vacias(client):
    """Cabecera con nombres vacíos y duplicados."""
    data = make_xlsx({
        "Hoja1": [
            ["Producto", "", "Importe", "Producto", "Fecha"],  # duplicados y vacío
            ["Sofa", 3, 450.5, "Mesa", "2026-01-15"],
            ["Silla", 10, 300.0, "Lampara", "2026-02-20"],
        ]
    })
    resp = upload(client, data, "dup_vacias.xlsx")
    assert resp.status_code == 201
    body = resp.json()
    hoja = body["sheets"][0]
    assert hoja["header_row"] == 1
    # Normalización: vacío -> "Columna N", duplicado -> " (2)"
    assert hoja["header"][0] == "Producto"
    assert hoja["header"][1] == "Columna 2"  # vacío
    assert hoja["header"][2] == "Importe"
    assert hoja["header"][3] == "Producto (2)"  # duplicado
    assert hoja["header"][4] == "Fecha"
    assert hoja["rows"] == 2


# 5. Hoja ancha (250 columnas) -> truncada: columnas
def test_parser_hoja_ancha_truncada(client, monkeypatch):
    """Hoja con 250 columnas (max_columns=200) debe truncarse con aviso."""
    monkeypatch.setattr(settings, "max_columns", 200)
    # 250 columnas
    headers = [f"Col{i}" for i in range(1, 251)]
    row = list(range(250))
    data = make_xlsx({"Ancha": [headers, row]})
    resp = upload(client, data, "ancha.xlsx")
    assert resp.status_code == 201
    body = resp.json()
    hoja = body["sheets"][0]
    assert hoja["truncada"] == "columnas"
    assert hoja["cols"] == 200
    assert len(hoja["header"]) == 200
    assert hoja["data"][0] == list(range(200))


# 6. CSV con delimitador ';'
def test_parser_csv_delimitador_punto_y_coma(client):
    """CSV con ; y coma decimal europea."""
    csv_content = (
        b"Producto;Unidades;Importe;Fecha\n"
        b"Sofa;3;450,5;15/01/2026\n"
        b"Mesa;1;120,0;20/02/2026\n"
    )
    resp = client.post(
        "/api/v1/workbooks",
        files={"file": ("ventas.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 201
    body = resp.json()
    hoja = body["sheets"][0]
    assert hoja["name"] == "ventas"
    assert hoja["header"] == ["Producto", "Unidades", "Importe", "Fecha"]
    assert hoja["rows"] == 2
    # Coma decimal convertida
    assert hoja["data"][0][2] == 450.5
    assert hoja["data"][1][2] == 120.0