"""Tests del endurecimiento de la auditoria v0 (H1, H2, H3, H6, H7, H9)."""

import tomllib
import zipfile
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook, load_workbook
from starlette.requests import Request

from app.core import ratelimit
from app.core.config import settings
from app.main import app

BACKEND = Path(__file__).resolve().parents[1]
CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.fixture(autouse=True)
def uploads_en_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", tmp_path)


@pytest.fixture()
def client():
    return TestClient(app)


def _xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Hoja"
    ws.append(["A", "B"])
    ws.append([1, 2])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _subir(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/workbooks", files={"file": ("demo.xlsx", _xlsx(), CONTENT_TYPE)}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _exportar(client: TestClient, wid: str, payload: dict):
    return client.post(f"/api/v1/workbooks/{wid}/sheets/Hoja/export", json=payload)


# ---------------------------------------------------------------- H6: formulas


def test_export_texto_con_igual_no_se_escribe_como_formula(client):
    wid = _subir(client)
    resp = _exportar(
        client, wid, {"header": ["A", "B"], "rows": [['=HYPERLINK("http://x","y")', "ok"]]}
    )
    assert resp.status_code == 200
    with zipfile.ZipFile(BytesIO(resp.content)) as zf:
        hoja = zf.read("xl/worksheets/sheet1.xml")
    assert b"<f>" not in hoja and b"<f " not in hoja
    # El texto sigue ahi, intacto, como texto
    assert list(load_workbook(BytesIO(resp.content)).active.values)[1][0] == (
        '=HYPERLINK("http://x","y")'
    )


def test_export_conserva_numeros_y_booleanos(client):
    wid = _subir(client)
    resp = _exportar(client, wid, {"header": ["N", "B"], "rows": [[1.5, True], [3, None]]})
    assert resp.status_code == 200
    filas = list(load_workbook(BytesIO(resp.content)).active.values)
    assert filas == [("N", "B"), (1.5, True), (3, None)]


# ------------------------------------------------------- H1: export en streaming


def test_export_usa_escritura_en_streaming():
    """write_only: el libro no se materializa entero en memoria."""
    from app.domain import excel_parser

    contenido = excel_parser.build_export(["A"], [[i] for i in range(1000)])
    with zipfile.ZipFile(BytesIO(contenido)) as zf:
        assert "xl/worksheets/sheet1.xml" in zf.namelist()
    assert len(list(load_workbook(BytesIO(contenido)).active.values)) == 1001


def test_export_limitado_por_ip(client, monkeypatch):
    monkeypatch.setattr(settings, "export_rate_limit", 1)
    wid = _subir(client)
    payload = {"header": ["A"], "rows": [[1]]}
    assert _exportar(client, wid, payload).status_code == 200
    assert _exportar(client, wid, payload).status_code == 429


# ----------------------------------------------------- H9: limite de cuerpo (413)


def test_subida_con_content_length_excesivo_413(client):
    declarado = (settings.max_upload_mb + 5) * 1024 * 1024
    resp = client.post(
        "/api/v1/workbooks",
        content=b"x",
        headers={"Content-Length": str(declarado), "Content-Type": "text/plain"},
    )
    assert resp.status_code == 413


def test_export_con_content_length_excesivo_413(client):
    wid = _subir(client)
    declarado = (settings.max_export_body_mb + 5) * 1024 * 1024
    resp = client.post(
        f"/api/v1/workbooks/{wid}/sheets/Hoja/export",
        content=b"{}",
        headers={"Content-Length": str(declarado), "Content-Type": "application/json"},
    )
    assert resp.status_code == 413


# --------------------------------------------------- H2: tope global y IPv6 /64


def test_tope_global_de_libros_503(client, monkeypatch):
    monkeypatch.setattr(settings, "max_stored_books", 1)
    _subir(client)
    resp = client.post(
        "/api/v1/workbooks", files={"file": ("otro.xlsx", _xlsx(), CONTENT_TYPE)}
    )
    assert resp.status_code == 503


def _peticion(xff: str) -> Request:
    return Request(
        {
            "type": "http",
            "headers": [(b"x-forwarded-for", xff.encode())],
            "client": ("10.0.0.1", 1234),
        }
    )


def test_ipv6_del_mismo_64_comparte_cubo():
    a = ratelimit.ip_real(_peticion("2001:db8:abcd:12::1"))
    b = ratelimit.ip_real(_peticion("2001:db8:abcd:12:ffff:ffff:ffff:ffff"))
    c = ratelimit.ip_real(_peticion("2001:db8:abcd:13::1"))
    assert a == b
    assert a != c


def test_ipv4_no_cambia():
    assert ratelimit.ip_real(_peticion("198.51.100.1, 203.0.113.9")) == "203.0.113.9"


# ---------------------------------------------------- H3: rastro al exceder limite


def test_limite_excedido_deja_log_con_la_ip(caplog):
    limiter = ratelimit.RateLimiter()
    limiter.comprobar("203.0.113.9", 1, 3600, "pruebas")
    with caplog.at_level("WARNING", logger="easyexcel.ratelimit"):
        with pytest.raises(ratelimit.LimiteExcedido):
            limiter.comprobar("203.0.113.9", 1, 3600, "pruebas")
    assert "203.0.113.9" in caplog.text


# ------------------------------------------------ H7: una sola fuente de deps


def _nombres(lineas) -> set[str]:
    salida = set()
    for linea in lineas:
        linea = linea.split("#")[0].strip()
        if linea:
            salida.add(linea.replace(" ", "").lower())
    return salida


def test_requirements_coincide_con_pyproject():
    """Render instala requirements.txt y el CI pyproject.toml: no pueden divergir."""
    pyproject = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))
    declaradas = _nombres(pyproject["project"]["dependencies"])
    pedidas = _nombres((BACKEND / "requirements.txt").read_text(encoding="utf-8").splitlines())
    assert declaradas == pedidas
