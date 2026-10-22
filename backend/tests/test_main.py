"""Tests de la aplicación: docs de OpenAPI por entorno (producción vs dev)."""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app


def test_docs_activos_por_defecto_en_desarrollo(monkeypatch):
    monkeypatch.delenv("RENDER", raising=False)
    client = TestClient(create_app())
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_docs_desactivados_en_render(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    client = TestClient(create_app())
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_docs_activos_en_render_si_lo_fuerza_la_env(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setattr(settings, "docs_enabled", True)
    client = TestClient(create_app())
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_docs_desactivados_en_local_si_lo_dice_la_env(monkeypatch):
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setattr(settings, "docs_enabled", False)
    client = TestClient(create_app())
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
