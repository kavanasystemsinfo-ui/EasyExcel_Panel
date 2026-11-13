"""El libro demo cerámico (ADR-0008) debe traer lo que el panel lee de él."""

from io import BytesIO

from openpyxl import load_workbook

from app.core.demo import _generate_ceramica_demo


def _hoja(nombre: str) -> list[tuple]:
    wb = load_workbook(BytesIO(_generate_ceramica_demo()), read_only=True)
    return list(wb[nombre].iter_rows(values_only=True))


def test_auditorias_trae_puntuacion_numerica_para_el_kpi_de_calidad():
    filas = _hoja("Auditorias")
    cabecera = filas[0]
    assert "Puntuacion" in cabecera
    i = cabecera.index("Puntuacion")
    puntuaciones = [f[i] for f in filas[1:]]
    assert len(puntuaciones) == 30
    assert all(isinstance(p, int) and 0 <= p <= 100 for p in puntuaciones)


def test_la_puntuacion_es_coherente_con_el_resultado():
    filas = _hoja("Auditorias")
    cabecera = filas[0]
    ir, ip = cabecera.index("Resultado"), cabecera.index("Puntuacion")
    for f in filas[1:]:
        if f[ir] == "Conforme":
            assert f[ip] >= 90
        elif f[ir] == "No conforme":
            assert f[ip] < 80


def test_generar_el_demo_es_determinista():
    assert _hoja("Empleados") == _hoja("Empleados")
