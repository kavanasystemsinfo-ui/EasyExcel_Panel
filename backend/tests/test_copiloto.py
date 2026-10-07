"""Tests del endpoint del copiloto IA (modelos gratuitos conmutable)."""

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai import assistant
from app.main import app

client = TestClient(app)


class _Ctx:
    def __init__(self) -> None:
        self.llamadas: list[dict[str, Any]] = []


def _fake_stream(texto: str = "Respuesta de prueba.") -> Any:
    async def fake(
        prov: assistant.Proveedor,
        modelo: str,
        messages: list[dict[str, str]],
        *,
        max_tokens: int,
        timeout: float,
    ) -> AsyncIterator[str]:
        yield texto

    return fake


def _fake_falla(status_code: int = 429) -> Any:
    async def fake(*args: Any, **kwargs: Any) -> AsyncIterator[str]:
        request = httpx.Request("POST", "https://ejemplo/v1/chat/completions")
        response = httpx.Response(status_code, request=request)
        raise httpx.HTTPStatusError("fallo", request=request, response=response)
        yield ""  # pragma: no cover - convierte la corrutina en async generator

    return fake


@pytest.fixture(autouse=True)
def _limpiar(  # noqa: ANN202
    monkeypatch: pytest.MonkeyPatch,
) -> Any:
    assistant._ventanas.clear()
    assistant._cache.clear()
    monkeypatch.setattr(
        assistant.settings, "openrouter_api_key", "sk-or-test", raising=True
    )
    monkeypatch.setattr(assistant.settings, "nvidia_api_key", "nvapi-test", raising=True)
    yield


def _cuerpo(pregunta: str = "¿Cuántos empleados hay?", contexto: dict | None = None) -> dict:
    return {"pregunta": pregunta, "contexto": contexto or {"hoja": "Empleados"}}


def test_sin_claves_devuelve_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(assistant.settings, "openrouter_api_key", "")
    monkeypatch.setattr(assistant.settings, "nvidia_api_key", "")
    response = client.post("/api/v1/copiloto", json=_cuerpo())
    assert response.status_code == 503
    assert "clave" in response.json()["detail"].lower()


def test_stream_ok_devuelve_sse_con_delta_y_fin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(assistant, "_stream_chat", _fake_stream("Hola encargado"))
    response = client.post("/api/v1/copiloto", json=_cuerpo())
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    eventos = [
        json.loads(line[6:])
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
    textos = [e["c"] for e in eventos if e["t"] == "delta"]
    fin = [e for e in eventos if e["t"] == "fin"]
    assert "".join(textos) == "Hola encargado"
    assert fin and fin[0]["proveedor"] in {"openrouter", "nvidia"}
    assert fin[0]["cache"] is False


def test_openrouter_agotado_cae_en_nvidia(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ctx = _Ctx()
    original = _fake_stream("Rescatado")

    async def sel(
        prov: assistant.Proveedor,
        modelo: str,
        messages: list[dict[str, str]],
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        ctx.llamadas.append({"prov": prov.nombre, "modelo": modelo})
        if prov.nombre == "openrouter":
            request = httpx.Request("POST", "https://x/v1")
            response = httpx.Response(429, request=request)
            raise httpx.HTTPStatusError("429", request=request, response=response)
        async for trozo in original(prov, modelo, messages, **kwargs):
            yield trozo

    monkeypatch.setattr(assistant, "_stream_chat", sel)
    response = client.post("/api/v1/copiloto", json=_cuerpo())
    assert response.status_code == 200
    eventos = [
        json.loads(line[6:])
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
    fin = [e for e in eventos if e["t"] == "fin"]
    assert fin, "debe llegar el evento fin"
    assert fin[0]["proveedor"] == "nvidia"
    assert len(ctx.llamadas) == 3


def test_todos_los_proveedores_fallan_emite_evento_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(assistant, "_stream_chat", _fake_falla())
    response = client.post("/api/v1/copiloto", json=_cuerpo())
    eventos = [
        json.loads(line[6:])
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
    errores = [e for e in eventos if e["t"] == "error"]
    assert errores and "detalle" in errores[0]


def test_rate_limit_devuelve_429(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(assistant.settings, "copiloto_rate_limit", 2)
    monkeypatch.setattr(assistant, "_stream_chat", _fake_stream())
    for _ in range(2):
        assert client.post("/api/v1/copiloto", json=_cuerpo()).status_code == 200
    assert client.post("/api/v1/copiloto", json=_cuerpo()).status_code == 429


def test_cache_evita_segunda_llamada_al_proveedor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ctx = _Ctx()
    base = _fake_stream("Valor cacheado")

    async def contar(
        prov: assistant.Proveedor,
        modelo: str,
        messages: list[dict[str, str]],
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        ctx.llamadas.append({"modelo": modelo})
        async for trozo in base(prov, modelo, messages, **kwargs):
            yield trozo

    monkeypatch.setattr(assistant, "_stream_chat", contar)
    primero = client.post("/api/v1/copiloto", json=_cuerpo())
    segundo = client.post("/api/v1/copiloto", json=_cuerpo())
    assert primero.status_code == 200 and segundo.status_code == 200
    assert len(ctx.llamadas) == 1
    eventos_cache = [
        json.loads(line[6:])
        for line in segundo.text.splitlines()
        if line.startswith("data: ")
    ]
    fin_cache = [e for e in eventos_cache if e["t"] == "fin"]
    assert fin_cache and fin_cache[0]["cache"] is True


def test_pregunta_y_contexto_llegan_al_modelo(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ctx = _Ctx()
    base = _fake_stream("ok")

    async def capturar(
        prov: assistant.Proveedor,
        modelo: str,
        messages: list[dict[str, str]],
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        ctx.llamadas.append({"messages": messages})
        async for trozo in base(prov, modelo, messages, **kwargs):
            yield trozo

    monkeypatch.setattr(assistant, "_stream_chat", capturar)
    client.post(
        "/api/v1/copiloto",
        json=_cuerpo(
            pregunta="¿Cuántos están de vacaciones?",
            contexto={"hoja": "Empleados", "kpis": [{"label": "Total", "value": 215}]},
        ),
    )
    messages = ctx.llamadas[0]["messages"]
    system = messages[0]["content"]
    assert messages[-1]["content"] == "¿Cuántos están de vacaciones?"
    assert "215" in system and "Empleados" in system
    assert messages[0]["role"] == "system"


def test_pregunta_vacia_devuelve_422() -> None:
    response = client.post("/api/v1/copiloto", json={"pregunta": "", "contexto": {}})
    assert response.status_code == 422


def test_contexto_gigante_devuelve_422() -> None:
    response = client.post(
        "/api/v1/copiloto",
        json={"pregunta": "hola", "contexto": {"bloat": "x" * 70_000}},
    )
    assert response.status_code == 422
