"""Asistente del copiloto: cadena de modelos gratuitos conmutable.

Orden medido el 2026-10-06 (benchmark real con latencias):
    OpenRouter inclusionai/ling-3.1-flash  ttfb 1.5s
    OpenRouter cohere/north-mini-code:free ttfb 1.4s
    NVIDIA    google/gemma-4-31b-it        ~45s (respaldo por cuota agotada)
"""

import asyncio
import hashlib
import json
import logging
import time
from collections import OrderedDict
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings

SYSTEM_PROMPT = (
    "Eres el copiloto de EasyExcel Panel, un panel de datos Excel para un "
    "encargado de operaciones y personal.\n"
    "Responde en espanol, de forma breve y directa (maximo 80 palabras salvo que te pidan mas).\n"
    "REGLAS ESTRICTAS:\n"
    "- Usa SOLO los datos del CONTEXTO entregado; no inventes numeros, nombres ni fechas.\n"
    "- Si un dato no esta en el contexto, digalo claramente en vez de suponerlo.\n"
    "- Los numeros del contexto los calculo el sistema: reproducelos tal cual.\n"
    "- No edites datos ni ejecutes codigo; solo explica, resume y redacta.\n"
    "CUANDO PIDAN UN RESUMEN (\"¿Cómo va el día?\", \"qué hay que gestionar\", "
    "\"estado general\"):\n"
    "- 1) Estado general del dia en una frase, con datos concretos del contexto.\n"
    "- 2) Acciones más importantes o urgentes: hasta 3, cada una con su dato y "
    "por qué es urgente.\n"
    "- 3) Puntos no críticos que requieren atención: lista breve de lo que "
    "también aparece en el contexto.\n"
    "- Ordena por urgencia y basatelo solo en el CONTEXTO.\n"
)

_FALLAS_TRANSPORTE = (httpx.HTTPError, OSError, asyncio.TimeoutError)

logger = logging.getLogger("easyexcel.copiloto")


@dataclass(frozen=True)
class Proveedor:
    nombre: str
    base_url: str
    api_key: str
    modelos: list[str]


class SinClavesError(Exception):
    """No hay ninguna API key configurada en el servidor."""


class RateLimitError(Exception):
    """Se supero el numero de consultas permitidas por ventana."""


_ventanas: dict[str, list[float]] = {}
_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()


def proveedores_configurados() -> list[Proveedor]:
    proveedores: list[Proveedor] = []
    if settings.openrouter_api_key:
        proveedores.append(
            Proveedor(
                nombre="openrouter",
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.openrouter_api_key,
                modelos=_modelos(settings.openrouter_models),
            )
        )
    if settings.nvidia_api_key:
        proveedores.append(
            Proveedor(
                nombre="nvidia",
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=settings.nvidia_api_key,
                modelos=_modelos(settings.nvidia_models),
            )
        )
    return proveedores


def _modelos(cadena: str) -> list[str]:
    return [m.strip() for m in cadena.split(",") if m.strip()]


def comprobar_rate(ip: str) -> None:
    ahora = time.monotonic()
    ventana = settings.copiloto_rate_window_s
    marcas = [t for t in _ventanas.get(ip, []) if ahora - t < ventana]
    if len(marcas) >= settings.copiloto_rate_limit:
        _ventanas[ip] = marcas
        raise RateLimitError(
            f"Demasiadas consultas al copiloto. Vuelve a intentarlo en {ventana // 60} minutos."
        )
    marcas.append(ahora)
    _ventanas[ip] = marcas


def _mensajes(pregunta: str, contexto: dict[str, Any]) -> list[dict[str, str]]:
    blob = json.dumps(contexto, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    system_content = f"{SYSTEM_PROMPT}\nCONTEXTO (datos reales del sistema):\n{blob}"
    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": pregunta},
    ]


def _clave_cache(pregunta: str, contexto: dict[str, Any]) -> str:
    blob = json.dumps(
        {"p": pregunta, "c": contexto}, ensure_ascii=False, sort_keys=True
    )
    return hashlib.sha256(blob.encode()).hexdigest()


async def _stream_chat(
    proveedor: Proveedor,
    modelo: str,
    messages: list[dict[str, str]],
    *,
    max_tokens: int,
    timeout: float,
) -> AsyncIterator[str]:
    payload = {
        "model": modelo,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": True,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + proveedor.api_key,
    }
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(timeout, connect=10.0)
    ) as cliente:
        async with cliente.stream(
            "POST",
            f"{proveedor.base_url}/chat/completions",
            json=payload,
            headers=headers,
        ) as respuesta:
            if respuesta.status_code >= 400:
                await respuesta.aread()
                raise httpx.HTTPStatusError(
                    f"HTTP {respuesta.status_code}",
                    request=respuesta.request,
                    response=respuesta,
                )
            async for linea in respuesta.aiter_lines():
                texto = linea.strip()
                if not texto.startswith("data:"):
                    continue
                datos = texto[5:].strip()
                if datos == "[DONE]":
                    break
                try:
                    evento = json.loads(datos)
                except ValueError:
                    continue
                choices = evento.get("choices") or []
                delta = (choices[0] or {}).get("delta") or {}
                trozo = delta.get("content")
                if trozo:
                    yield trozo


async def stream_respuesta(
    pregunta: str, contexto: dict[str, Any]
) -> AsyncIterator[dict[str, Any]]:
    proveedores = proveedores_configurados()
    if not proveedores:
        raise SinClavesError(
            "Sin claves de IA: configura OPENROUTER_API_KEY o NVIDIA_API_KEY en backend/.env"
        )

    clave = _clave_cache(pregunta, contexto)
    if clave in _cache:
        entrada = _cache[clave]
        _cache.move_to_end(clave)
        yield {"t": "delta", "c": entrada["texto"]}
        yield {
            "t": "fin",
            "proveedor": entrada["proveedor"],
            "modelo": entrada["modelo"],
            "cache": True,
        }
        return

    messages = _mensajes(pregunta, contexto)
    texto = ""
    usado: tuple[str, str] | None = None
    for proveedor in proveedores:
        if usado:
            break
        for modelo in proveedor.modelos:
            trozos: list[str] = []
            inicio = time.monotonic()
            try:
                async for trozo in _stream_chat(
                    proveedor,
                    modelo,
                    messages,
                    max_tokens=settings.copiloto_max_tokens,
                    timeout=settings.copiloto_timeout_s,
                ):
                    trozos.append(trozo)
                    yield {"t": "delta", "c": trozo}
            except _FALLAS_TRANSPORTE as exc:
                logger.warning(
                    "copiloto: fallo %s/%s (%s): %s",
                    proveedor.nombre,
                    modelo,
                    type(exc).__name__,
                    str(exc)[:120],
                )
                if not trozos:
                    continue
            if trozos:
                texto = "".join(trozos)
                usado = (proveedor.nombre, modelo)
                logger.info(
                    "copiloto: respuesta via %s/%s en %.2fs",
                    proveedor.nombre,
                    modelo,
                    time.monotonic() - inicio,
                )
                break
            logger.warning(
                "copiloto: %s/%s devolvio contenido vacio", proveedor.nombre, modelo
            )

    if not usado:
        yield {
            "t": "error",
            "detalle": (
                "Los modelos gratuitos no respondieron (cuota agotada o timeout). "
                "Intentalo de nuevo en unos minutos."
            ),
        }
        return

    _cache[clave] = {"texto": texto, "proveedor": usado[0], "modelo": usado[1]}
    _cache.move_to_end(clave)
    while len(_cache) > settings.copiloto_cache_size:
        _cache.popitem(last=False)

    yield {"t": "fin", "proveedor": usado[0], "modelo": usado[1], "cache": False}
