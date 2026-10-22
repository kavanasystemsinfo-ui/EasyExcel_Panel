"""Contratos de importación multi-formato (.xlsx, .xls, .ods, .csv).

Los formatos heredan los mismos límites del ADR-0001. La exportación
sigue siendo siempre .xlsx.
"""

from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from odf.opendocument import OpenDocumentSpreadsheet
from odf.table import Table, TableCell, TableRow
from odf.text import P

from app.core.config import settings
from app.main import app

FIXTURES = Path(__file__).parent / "fixtures"
CONTENT_TYPES = {
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".csv": "text/csv",
}


def upload(client: TestClient, data: bytes, filename: str):
    ext = Path(filename).suffix
    return client.post(
        "/api/v1/workbooks",
        files={"file": (filename, data, CONTENT_TYPES.get(ext, "application/octet-stream"))},
    )


def make_ods(sheets: dict[str, list[list[object]]]) -> bytes:
    import os
    import tempfile

    doc = OpenDocumentSpreadsheet()
    for name, rows in sheets.items():
        table = Table(name=name)
        for row in rows:
            tr = TableRow()
            for value in row:
                tc = TableCell()
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    tc.setAttribute("valuetype", "float")
                    tc.setAttribute("value", str(value))
                tc.addElement(P(text=str(value)))
                tr.addElement(tc)
            table.addElement(tr)
        doc.spreadsheet.addElement(table)
    fd, path = tempfile.mkstemp(suffix=".ods")
    os.close(fd)
    try:
        doc.write(path)
        return Path(path).read_bytes()
    finally:
        Path(path).unlink(missing_ok=True)


@pytest.fixture(autouse=True)
def uploads_en_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", tmp_path)


@pytest.fixture()
def client():
    return TestClient(app)


# -------------------------------------------------------------------- csv


CSV_SEMICOLON = (
    b"Producto;Unidades;Importe;Fecha\n"
    b"Sofa;3;450,5;15/01/2026\n"
    b"Mesa;1;120;20/02/2026\n"
    b"Silla;10;300,75;01/03/2026\n"
)

CSV_COMMA = (
    "Producto,Unidades,Importe\n"
    "Sofa,3,450.5\n"
    "Mesa,1,120\n"
).encode("utf-8-sig")


def test_csv_semicolon_convierte_decimal_coma(client):
    resp = upload(client, CSV_SEMICOLON, "ventas.csv")
    assert resp.status_code == 201
    body = resp.json()
    assert [s["name"] for s in body["sheets"]] == ["ventas"]
    hoja = body["sheets"][0]
    assert hoja["header"] == ["Producto", "Unidades", "Importe", "Fecha"]
    assert hoja["rows"] == 3
    assert hoja["cols"] == 4
    assert hoja["data"][0] == ["Sofa", 3, 450.5, "15/01/2026"]
    assert hoja["data"][2] == ["Silla", 10, 300.75, "01/03/2026"]


def test_csv_comma_con_bom_utf8(client):
    resp = upload(client, CSV_COMMA, "resumen.csv")
    assert resp.status_code == 201
    hoja = resp.json()["sheets"][0]
    assert hoja["header"] == ["Producto", "Unidades", "Importe"]
    assert hoja["data"][0] == ["Sofa", 3, 450.5]


def test_csv_filas_paginadas(client):
    wb_id = upload(client, CSV_SEMICOLON, "ventas.csv").json()["id"]
    resp = client.get(f"/api/v1/workbooks/{wb_id}/sheets/ventas/rows?offset=1&limit=1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert body["rows"] == [["Mesa", 1, 120, "20/02/2026"]]


def test_csv_export_devuelve_xlsx(client):
    wb_id = upload(client, CSV_SEMICOLON, "ventas.csv").json()["id"]
    resp = client.post(
        f"/api/v1/workbooks/{wb_id}/sheets/ventas/export",
        json={"header": ["Producto", "Importe"], "rows": [["Sofa", 450.5]]},
    )
    assert resp.status_code == 200
    assert resp.content[:2] == b"PK"
    assert "ventas_ventas.xlsx" in resp.headers["content-disposition"]


def test_csv_rechaza_binario_con_nul(client):
    resp = upload(client, b"col1\x00col2\n1\x002\n", "datos.csv")
    assert resp.status_code == 400


def test_csv_latin1_con_acentos(client):
    data = "Producto;Ciudad\nAntonio;Málaga\n".encode("latin-1")
    resp = upload(client, data, "clientes.csv")
    assert resp.status_code == 201
    assert resp.json()["sheets"][0]["data"][0] == ["Antonio", "Málaga"]


# -------------------------------------------------------------------- xls


def test_xls_fixture_valida(client):
    data = (FIXTURES / "ventas.xls").read_bytes()
    resp = upload(client, data, "ventas.xls")
    assert resp.status_code == 201
    body = resp.json()
    assert [s["name"] for s in body["sheets"]] == ["Ventas"]
    hoja = body["sheets"][0]
    assert hoja["header"] == ["Producto", "Unidades", "Importe"]
    assert hoja["rows"] == 3
    assert hoja["data"][0] == ["Sofa", 3, 450.5]


def test_xlsx_renombrado_a_xls_rechazado(client):
    from openpyxl import Workbook

    wb = Workbook()
    wb.active.append(["a"])
    buf = BytesIO()
    wb.save(buf)
    resp = upload(client, buf.getvalue(), "disfraz.xls")
    assert resp.status_code == 400


# -------------------------------------------------------------------- ods


def test_ods_valida(client):
    data = make_ods(
        {
            "Ventas": [
                ["Producto", "Unidades", "Importe"],
                ["Sofa", 3, 450.5],
                ["Mesa", 1, 120.0],
            ]
        }
    )
    resp = upload(client, data, "ventas.ods")
    assert resp.status_code == 201
    body = resp.json()
    assert [s["name"] for s in body["sheets"]] == ["Ventas"]
    hoja = body["sheets"][0]
    assert hoja["header"] == ["Producto", "Unidades", "Importe"]
    assert hoja["rows"] == 2
    assert hoja["data"][0] == ["Sofa", 3, 450.5]


# ------------------------------------------------------- limites y rechazos


def test_extensiones_no_admitidas_rechazadas(client):
    resp = upload(client, b"whatever", "informe.pdf")
    assert resp.status_code == 400


def test_limites_aplican_al_csv(client, monkeypatch):
    monkeypatch.setattr(settings, "max_columns", 2)
    resp = upload(client, CSV_SEMICOLON, "ventas.csv")
    assert resp.status_code == 422


def test_csv_supera_max_filas(client, monkeypatch):
    monkeypatch.setattr(settings, "max_rows_per_sheet", 1)
    resp = upload(client, CSV_SEMICOLON, "ventas.csv")
    assert resp.status_code == 422
