import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..ai import assistant
from app.api.schemas import CopilotoPayload

router = APIRouter(tags=["copiloto"])


@router.post("/api/v1/copiloto")
async def copiloto(payload: CopilotoPayload, request: Request) -> Any:
    if not assistant.proveedores_configurados():
        return JSONResponse(
            {
                "detail": (
                    "Sin claves de IA: configura OPENROUTER_API_KEY o "
                    "NVIDIA_API_KEY en backend/.env"
                )
            },
            status_code=503,
        )

    ip = request.client.host if request.client else "anonimo"
    try:
        assistant.comprobar_rate(ip)
    except assistant.RateLimitError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=429)

    async def generar() -> AsyncIterator[str]:
        async for evento in assistant.stream_respuesta(
            payload.pregunta, payload.contexto
        ):
            yield f"data: {json.dumps(evento, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generar(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
