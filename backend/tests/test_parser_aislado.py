"""T-092 F2: el parseo corre en un subproceso con timeout y memoria limitados."""

import threading
import time
import zipfile
from io import BytesIO

import pytest
from fastapi.testclient import TestClient

from app.api.routes import workbooks
from app.domain.aislado import run_isolated
from app.errors import (
    InvalidWorkbookError,
    WorkbookLimitError,
    WorkbookParseTimeoutError,
)
from app.main import app

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


# Funciones de nivel de modulo: el contexto spawn las serializa por referencia.
def _dormir() -> None:
    time.sleep(10)


def _suma(a: int, b: int) -> int:
    return a + b


def _invalido() -> None:
    raise InvalidWorkbookError("mensaje de prueba")


def _memoria() -> None:
    raise MemoryError


def _rara() -> None:
    raise ValueError("x")


def test_timeout_mata_al_hijo_en_menos_de_5s():
    t0 = time.monotonic()
    with pytest.raises(WorkbookParseTimeoutError):
        run_isolated(_dormir, timeout_s=1, mem_mb=300)
    assert time.monotonic() - t0 < 5


def test_devuelve_el_resultado():
    assert run_isolated(_suma, 2, 3, timeout_s=20, mem_mb=300) == 5


def test_relanza_la_misma_excepcion_con_su_mensaje():
    with pytest.raises(InvalidWorkbookError, match="mensaje de prueba"):
        run_isolated(_invalido, timeout_s=20, mem_mb=300)


def test_memoria_se_traduce_a_limite():
    with pytest.raises(WorkbookLimitError, match="demasiada memoria"):
        run_isolated(_memoria, timeout_s=20, mem_mb=300)


def test_excepcion_desconocida_es_invalido_generico():
    with pytest.raises(InvalidWorkbookError):
        run_isolated(_rara, timeout_s=20, mem_mb=300)


def _zip_bomb() -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("xl/workbook.xml", "<workbook/>")
        zf.writestr("xl/basura.bin", b"\x00" * (5 * 1024 * 1024))  # ratio >> 200
    return buf.getvalue()


def test_zip_bomb_xlsx_devuelve_400():
    client = TestClient(app)
    r = client.post("/api/v1/workbooks", files={"file": ("bomba.xlsx", _zip_bomb(), XLSX)})
    assert r.status_code == 400


def test_subida_csv_sigue_devolviendo_201_con_filas():
    client = TestClient(app)
    csv = b"nombre,edad\nAna,30\nLuis,41\n"
    r = client.post("/api/v1/workbooks", files={"file": ("p.csv", csv, "text/csv")})
    assert r.status_code == 201
    assert r.json()["sheets"][0]["data"]


def test_demo_sigue_cargando_con_filas():
    client = TestClient(app)
    r = client.get("/api/v1/workbooks/demo")
    assert r.status_code == 200
    hoja = r.json()["sheets"][0]["name"]
    r = client.get(f"/api/v1/workbooks/demo/sheets/{hoja}/rows?limit=5")
    assert r.status_code == 200
    assert r.json()["rows"]


def test_health_responde_mientras_se_parsea(monkeypatch):
    def lento(func, *args, **kwargs):
        time.sleep(2)
        return run_isolated(func, *args, **kwargs)

    monkeypatch.setattr(workbooks, "run_isolated", lento)
    resultados: dict = {}

    def subir():
        with TestClient(app) as c:
            resultados["up"] = c.post(
                "/api/v1/workbooks",
                files={"file": ("p.csv", b"a,b\n1,2\n", "text/csv")},
            ).status_code

    hilo = threading.Thread(target=subir)
    hilo.start()
    time.sleep(0.5)
    t0 = time.monotonic()
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200
    assert time.monotonic() - t0 < 1.5
    hilo.join()
    assert resultados["up"] == 201
