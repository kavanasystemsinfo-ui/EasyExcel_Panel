"""Fixtures globales de la suite del backend."""

import pytest

from app.api.routes import workbooks


@pytest.fixture(autouse=True)
def limpiar_rate_limit_subidas():
    """Cada test empieza con la cuota de subidas fresca (ventana de 1 hora)."""
    workbooks._subidas.limpiar()
    yield
    workbooks._subidas.limpiar()
