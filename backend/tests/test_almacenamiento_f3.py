"""T-092 F3: sin copias book.b64, purga periodica y timeout total del parseo."""

import json
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app import main as app_main
from app.api.routes import workbooks
from app.core.config import settings
from app.core.storage import WorkbookStorage
from app.domain.aislado import run_isolated
from app.main import app


def test_save_book_no_crea_book_b64(tmp_path):
    st = WorkbookStorage(tmp_path)
    wb_id = st.save_book(b"datos")
    assert (tmp_path / wb_id / "book.xlsx").is_file()
    assert not (tmp_path / wb_id / "book.b64").exists()


def test_save_book_as_no_crea_book_b64(tmp_path):
    st = WorkbookStorage(tmp_path)
    wb_id = "a" * 32
    st.save_book_as(wb_id, b"datos")
    assert not (tmp_path / wb_id / "book.b64").exists()


def test_ensure_book_exists_no_regenera(tmp_path):
    st = WorkbookStorage(tmp_path)
    wb_id = st.save_book(b"datos")
    st.book_path(wb_id).unlink()
    try:
        st._ensure_book_exists(wb_id)
    except FileNotFoundError:
        return
    raise AssertionError("debia lanzar FileNotFoundError")


def test_purgar_caducados_borra_lo_vencido(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    monkeypatch.setattr(settings, "upload_ttl_hours", 2.0)
    st = WorkbookStorage(tmp_path)
    viejo = st.save_book(b"x")
    st.finalize(viejo, "v.xlsx", [])
    manifest = tmp_path / viejo / "manifest.json"
    datos = json.loads(manifest.read_text(encoding="utf-8"))
    datos["uploaded_at"] = (datetime.now(UTC) - timedelta(hours=3)).isoformat()
    manifest.write_text(json.dumps(datos), encoding="utf-8")
    nuevo = st.save_book(b"y")
    st.finalize(nuevo, "n.xlsx", [])

    assert app_main.purgar_caducados() == 1
    assert not (tmp_path / viejo).exists()
    assert (tmp_path / nuevo).exists()


def test_lifespan_arranca_y_para_la_tarea():
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200


def test_subida_pasa_el_timeout_total(monkeypatch):
    capturado: dict = {}

    def espia(func, *args, **kwargs):
        capturado.update(kwargs)
        return run_isolated(func, *args, **kwargs)

    monkeypatch.setattr(workbooks, "run_isolated", espia)
    r = TestClient(app).post(
        "/api/v1/workbooks",
        files={"file": ("p.csv", b"a,b\n1,2\n", "text/csv")},
    )
    assert r.status_code == 201
    assert capturado["timeout_s"] == settings.parse_total_timeout_s
    assert settings.parse_total_timeout_s == 90.0
