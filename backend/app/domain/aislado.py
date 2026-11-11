"""Ejecuta una funcion en un subproceso real con timeout y memoria limitados.

Un Excel malicioso o enorme solo puede matar al hijo, no a la API: el padre
espera con un plazo y, si se excede, termina al hijo. Las funciones pasadas
deben ser de nivel de modulo (el contexto "spawn" las serializa con pickle).
"""

import multiprocessing as mp
import sys
from typing import Any

from app.errors import (
    InvalidWorkbookError,
    WorkbookLimitError,
    WorkbookNotFoundError,
    WorkbookParseTimeoutError,
)

_RELANZABLES = {
    "InvalidWorkbookError": InvalidWorkbookError,
    "WorkbookLimitError": WorkbookLimitError,
    "WorkbookNotFoundError": WorkbookNotFoundError,
    "WorkbookParseTimeoutError": WorkbookParseTimeoutError,
}
_MSG_MEMORIA = "El archivo necesita demasiada memoria"
_MSG_TIMEOUT = (
    "El archivo es demasiado grande para analizarlo, "
    "prueba a quitar columnas o hojas"
)


def _hijo(conn, func, args, kwargs, mem_mb: int, ajustes: dict) -> None:
    try:
        # El hijo (spawn) arranca con la config por defecto: se le aplica la
        # del padre para que ambos apliquen los mismos limites.
        from app.core.config import settings

        for clave, valor in ajustes.items():
            object.__setattr__(settings, clave, valor)
        if sys.platform.startswith("linux"):
            import resource

            limite = mem_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (limite, limite))
        resultado = func(*args, **kwargs)
        conn.send(("ok", resultado))
    except MemoryError:
        conn.send(("mem", None))
    except BaseException as exc:  # noqa: BLE001
        nombre = type(exc).__name__
        if nombre in _RELANZABLES:
            conn.send(("err", (nombre, str(exc))))
        else:
            conn.send(("otro", f"{nombre}: {exc}"))
    finally:
        conn.close()


def _terminar(proc) -> None:
    proc.terminate()
    proc.join(2)
    if proc.is_alive():
        proc.kill()
        proc.join(2)


def run_isolated(func, *args, timeout_s: float, mem_mb: int, **kwargs) -> Any:
    ctx = mp.get_context("spawn")
    recv, send = ctx.Pipe(duplex=False)
    from app.core.config import settings

    proc = ctx.Process(
        target=_hijo,
        args=(send, func, args, kwargs, mem_mb, settings.model_dump()),
        daemon=True,
    )
    proc.start()
    send.close()
    try:
        # Se espera el resultado por el pipe y no solo con join(): un
        # resultado grande bloquea al hijo en send() hasta que el padre lee.
        if not recv.poll(timeout_s):
            _terminar(proc)
            raise WorkbookParseTimeoutError(_MSG_TIMEOUT)
        try:
            tipo, valor = recv.recv()
        except (EOFError, OSError):
            # El hijo murio sin devolver nada (p. ej. OOM-kill).
            raise WorkbookLimitError(_MSG_MEMORIA) from None
        proc.join(2)
    finally:
        recv.close()
        if proc.is_alive():
            _terminar(proc)
    if tipo == "ok":
        return valor
    if tipo == "mem":
        raise WorkbookLimitError(_MSG_MEMORIA)
    if tipo == "err":
        nombre, mensaje = valor
        raise _RELANZABLES[nombre](mensaje)
    raise InvalidWorkbookError("No se pudo analizar el archivo")
