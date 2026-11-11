import asyncio
import contextlib
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ai import assistant
from app.api.routes import copiloto, health, workbooks
from app.core.config import settings
from app.core.demo import DEMO_ID
from app.core.ratelimit import LimiteExcedido
from app.core.storage import WorkbookStorage
from app.errors import (
    ForbiddenError,
    InvalidWorkbookError,
    WorkbookLimitError,
    WorkbookNotFoundError,
    WorkbookParseTimeoutError,
    WorkbookTooLargeError,
)

logger = logging.getLogger("easyexcel.purga")

PURGA_INTERVALO_S = 600.0  # cada 10 minutos


def purgar_caducados() -> int:
    """Borra las subidas que superan el TTL (nunca el demo)."""
    return WorkbookStorage(settings.upload_dir).purge_expired(
        settings.upload_ttl_hours, exclude={DEMO_ID}
    )


async def _bucle_purga(intervalo_s: float = PURGA_INTERVALO_S) -> None:
    while True:
        try:
            await asyncio.to_thread(purgar_caducados)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Fallo en la purga periodica de subidas")
        await asyncio.sleep(intervalo_s)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    tarea = asyncio.create_task(_bucle_purga())
    try:
        yield
    finally:
        tarea.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await tarea


def create_app() -> FastAPI:
    if settings.docs_enabled is not None:
        docs_activos = settings.docs_enabled
    else:
        # En Render (RENDER=true) la API es publica: sin Swagger abierto.
        docs_activos = not os.environ.get("RENDER")
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        docs_url="/docs" if docs_activos else None,
        openapi_url="/openapi.json" if docs_activos else None,
        lifespan=lifespan,
    )
    if not assistant.logger.handlers:
        log_handler = logging.StreamHandler()
        log_handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
        assistant.logger.addHandler(log_handler)
        assistant.logger.setLevel(logging.INFO)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["*"],
    )
    
    app.include_router(health.router)
    app.include_router(workbooks.router)
    app.include_router(copiloto.router)

    def handler(status_code: int):
        def _handle(request: Request, exc: Exception) -> JSONResponse:
            detail = str(exc) or type(exc).__name__
            return JSONResponse({"detail": detail}, status_code=status_code)

        return _handle

    app.add_exception_handler(InvalidWorkbookError, handler(400))
    app.add_exception_handler(WorkbookTooLargeError, handler(413))
    app.add_exception_handler(WorkbookNotFoundError, handler(404))
    app.add_exception_handler(ForbiddenError, handler(403))
    app.add_exception_handler(WorkbookLimitError, handler(422))
    app.add_exception_handler(WorkbookParseTimeoutError, handler(422))
    app.add_exception_handler(LimiteExcedido, handler(429))
    return app


app = create_app()