import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ai import assistant
from app.api.routes import copiloto, health, workbooks
from app.core.config import settings
from app.errors import (
    InvalidWorkbookError,
    WorkbookLimitError,
    WorkbookNotFoundError,
    WorkbookParseTimeoutError,
    WorkbookTooLargeError,
)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.version)
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
    app.add_exception_handler(WorkbookLimitError, handler(422))
    app.add_exception_handler(WorkbookParseTimeoutError, handler(422))
    return app


app = create_app()
