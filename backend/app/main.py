from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import health, workbooks
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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(workbooks.router)

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
