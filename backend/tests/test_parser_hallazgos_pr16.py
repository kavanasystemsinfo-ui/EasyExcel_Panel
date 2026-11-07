"""Pruebas de reproducción de los hallazgos de la auditoría del PR #16 (T-030).

H1  cabecera mal con títulos combinados a lo ancho (y cabecera de dos niveles)
H2  varias tablas en una hoja
H3  celdas combinadas en el cuerpo (comportamiento deseado: rellenar hacia abajo)
H5  memoria: una hoja grande no debe cargarse entera en RAM
INE integración con tablas reales del INE (se omite sin red)
"""

import subprocess
import sys
import textwrap
import urllib.request
from pathlib import Path

import pytest
from odf import table as odf_table
from odf import text as odf_text
from odf.opendocument import OpenDocumentSpreadsheet
from openpyxl import Workbook

from app.domain.excel_parser import extract_metadata, read_rows

BACKEND = Path(__file__).resolve().parent.parent


def _guardar(wb: Workbook, tmp_path: Path, nombre: str = "libro.xlsx") -> Path:
    ruta = tmp_path / nombre
    wb.save(ruta)
    return ruta


def _leer(ruta: Path, hoja: str) -> tuple[dict, dict]:
    meta = next(s for s in extract_metadata(ruta) if s["name"] == hoja)
    datos = read_rows(ruta, hoja, 0, 1000)
    return meta, datos


CABECERA = ["Región", "Cliente", "Producto", "Unidades", "Importe"]


def test_h1_titulo_combinado_a_lo_ancho_xlsx(tmp_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Informe"
    ws["A1"] = "Informe de ventas 2025 - Empresa SL"
    ws.merge_cells("A1:E1")
    for i, nombre in enumerate(CABECERA, start=1):
        ws.cell(row=3, column=i, value=nombre)
    ws.append(["Norte", "ACME", "Tornillo", 10, 100.5])
    ws.append(["Sur", "Beta", "Tuerca", 20, 200.0])
    ws.append(["Este", "Gamma", "Arandela", 30, 300.0])
    meta, datos = _leer(_guardar(wb, tmp_path), "Informe")
    assert datos["header"] == CABECERA
    assert meta["header_row"] == 3
    assert meta["rows"] == 3
    assert datos["rows"][0][0] == "Norte"


def test_h1_cabecera_de_dos_niveles(tmp_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Niveles"
    ws["A1"] = "Resultados por zona"
    ws.merge_cells("A1:E1")
    ws["A3"] = "Zona"
    ws.merge_cells("A3:A4")
    ws["B3"] = "Ventas"
    ws.merge_cells("B3:C3")
    ws["D3"] = "Costes"
    ws.merge_cells("D3:E3")
    for col, nombre in zip("BCDE", ["Q1", "Q2", "Q1", "Q2"], strict=True):
        ws[f"{col}4"] = nombre
    ws.append(["Norte", 1, 2, 3, 4])
    ws.append(["Sur", 5, 6, 7, 8])
    meta, datos = _leer(_guardar(wb, tmp_path), "Niveles")
    assert datos["header"] == [
        "Zona",
        "Ventas · Q1",
        "Ventas · Q2",
        "Costes · Q1",
        "Costes · Q2",
    ]
    assert meta["rows"] == 2
    assert datos["rows"][0] == ["Norte", 1, 2, 3, 4]


def test_h1_titulo_combinado_a_lo_ancho_ods(tmp_path):
    doc = OpenDocumentSpreadsheet()
    tabla = odf_table.Table(name="Informe")
    fila = odf_table.TableRow()
    celda = odf_table.TableCell(valuetype="string", numbercolumnsspanned=5)
    celda.addElement(odf_text.P(text="Informe de ventas 2025"))
    fila.addElement(celda)
    for _ in range(4):
        fila.addElement(odf_table.CoveredTableCell())
    tabla.addElement(fila)
    tabla.addElement(odf_table.TableRow())
    filas = [
        CABECERA,
        ["Norte", "ACME", "Tornillo", "10", "100"],
        ["Sur", "Beta", "Tuerca", "20", "200"],
    ]
    for valores in filas:
        fila = odf_table.TableRow()
        for v in valores:
            c = odf_table.TableCell(valuetype="string")
            c.addElement(odf_text.P(text=v))
            fila.addElement(c)
        tabla.addElement(fila)
    doc.spreadsheet.addElement(tabla)
    ruta = tmp_path / "informe.ods"
    doc.save(str(ruta))
    meta, datos = _leer(ruta, "Informe")
    assert datos["header"] == CABECERA
    assert meta["header_row"] == 3
    assert meta["rows"] == 2


def test_h2_dos_tablas_en_la_misma_hoja(tmp_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Doble"
    ws.append(["Producto", "Unidades", "Importe"])
    for i in range(5):
        ws.append([f"P{i}", i + 1, (i + 1) * 10.0])
    ws.append([])
    ws.append([])
    ws.append(["Cliente", "Ciudad"])
    ws.append(["ACME", "Madrid"])
    ws.append(["Beta", "Valencia"])
    meta, datos = _leer(_guardar(wb, tmp_path), "Doble")
    assert datos["header"] == ["Producto", "Unidades", "Importe"]
    assert meta["rows"] == 5
    assert all(fila[0].startswith("P") for fila in datos["rows"])
    assert meta.get("aviso") and "varias tablas" in meta["aviso"]


def test_h2_titulo_aparte_no_genera_aviso(tmp_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Una"
    ws["A1"] = "Listado de clientes"
    ws["A3"] = "Cliente"
    ws["B3"] = "Ciudad"
    ws["A4"] = "ACME"
    ws["B4"] = "Madrid"
    meta, datos = _leer(_guardar(wb, tmp_path), "Una")
    assert datos["header"] == ["Cliente", "Ciudad"]
    assert not meta.get("aviso")


def test_h3_celdas_combinadas_en_el_cuerpo_se_rellenan(tmp_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Cuerpo"
    ws.append(["Región", "Cliente", "Importe"])
    ws.append(["Norte", "ACME", 100])
    ws.append([None, "Beta", 200])
    ws.append(["Sur", "Gamma", 300])
    ws.merge_cells("A2:A3")
    _, datos = _leer(_guardar(wb, tmp_path), "Cuerpo")
    assert [f[0] for f in datos["rows"]] == ["Norte", "Norte", "Sur"]
    assert [f[2] for f in datos["rows"]] == [100, 200, 300]


def test_h5_hoja_grande_no_se_carga_entera_en_memoria(tmp_path):
    ruta = tmp_path / "grande.xlsx"
    generar = textwrap.dedent(
        f"""
        from openpyxl import Workbook
        wb = Workbook(write_only=True)
        ws = wb.create_sheet("Grande")
        ws.append([f"Col{{i}}" for i in range(200)])
        for r in range(5000):
            ws.append([r * 1.5 + c for c in range(200)])
        wb.save(r"{ruta}")
        """
    )
    subprocess.run([sys.executable, "-I", "-c", generar], check=True)
    medir = textwrap.dedent(
        f"""
        import sys, threading, time
        sys.path.insert(0, r"{BACKEND}")
        import psutil
        from pathlib import Path
        from app.domain.excel_parser import extract_metadata, read_rows
        proc = psutil.Process()
        base = proc.memory_info().rss
        pico = [base]
        parar = [False]
        def vigilar():
            while not parar[0]:
                pico[0] = max(pico[0], proc.memory_info().rss)
                time.sleep(0.02)
        threading.Thread(target=vigilar, daemon=True).start()
        meta = extract_metadata(Path(r"{ruta}"))
        read_rows(Path(r"{ruta}"), "Grande", 0, 50)
        parar[0] = True
        print((pico[0] - base) // (1024 * 1024), meta[0]["rows"], meta[0]["header_row"])
        """
    )
    salida = subprocess.run(
        [sys.executable, "-c", medir], check=True, capture_output=True, text=True
    ).stdout.split()
    incremento_mb, filas, cabecera = int(salida[0]), int(salida[1]), int(salida[2])
    assert filas == 5000
    assert cabecera == 1
    assert incremento_mb < 80, f"la lectura añadió {incremento_mb} MB de RSS"


def _descargar_ine(tabla: str, destino: Path) -> Path | None:
    url = f"https://www.ine.es/jaxiT3/files/t/xlsx/{tabla}.xlsx"
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:  # noqa: S310
            datos = resp.read()
    except OSError:
        return None
    if len(datos) < 1000:
        return None
    ruta = destino / f"ine_{tabla}.xlsx"
    ruta.write_bytes(datos)
    return ruta


@pytest.mark.parametrize("tabla", ["2852", "67154"])
def test_ine_real_cabecera_con_nombres_distintos_del_titulo(tabla, tmp_path):
    ruta = _descargar_ine(tabla, tmp_path)
    if ruta is None:
        pytest.skip("sin red o INE no responde")
    meta = extract_metadata(ruta)[0]
    datos = read_rows(ruta, meta["name"], 0, 5)
    cabecera = datos["header"]
    assert meta["header_row"] > 1
    assert len(set(cabecera)) == len(cabecera)
    primera = [c for c in cabecera if not c.startswith("Columna ")]
    assert len(primera) >= 2
    # el título largo no puede repetirse como nombre de columna
    assert not any(" (2)" in c for c in cabecera)


# ----------------------------------------------------- segunda ronda (T-030 bis)


def test_h01_celda_combinada_en_cabecera_con_datos_de_texto_no_es_dos_niveles(tmp_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Texto"
    ws["A1"] = "X"
    ws["B1"] = "Y"
    ws.merge_cells("B1:C1")
    ws.append(["a", "b", "c"])
    ws.append(["d", "e", "f"])
    ws.append(["g", "h", "i"])
    _, datos = _leer(_guardar(wb, tmp_path), "Texto")
    assert datos["header"][0] == "X"
    assert not any("·" in nombre for nombre in datos["header"])
    assert len(datos["rows"]) == 3


def _con_doctype(origen: Path, destino: Path) -> None:
    import zipfile

    with zipfile.ZipFile(origen) as entrada, zipfile.ZipFile(destino, "w") as salida:
        for item in entrada.infolist():
            datos = entrada.read(item.filename)
            if item.filename == "xl/worksheets/sheet1.xml":
                texto = datos.decode("utf-8")
                cierre = texto.index("?>") + 2 if texto.startswith("<?xml") else 0
                texto = (
                    texto[:cierre]
                    + '<!DOCTYPE x [<!ENTITY a "aaaaaaaaaa">]>'
                    + texto[cierre:]
                )
                datos = texto.encode("utf-8")
            salida.writestr(item, datos)


def test_h03_xml_con_dtd_se_ignora_en_celdas_combinadas(tmp_path):
    from app.domain.excel_parser import _xlsx_combinadas

    wb = Workbook()
    ws = wb.active
    ws.title = "S"
    ws["A1"] = "T"
    ws.merge_cells("A1:C1")
    normal = _guardar(wb, tmp_path, "normal.xlsx")
    assert _xlsx_combinadas(str(normal), "S") == [(0, 1, 0, 3)]
    manipulado = tmp_path / "dtd.xlsx"
    _con_doctype(normal, manipulado)
    assert _xlsx_combinadas(str(manipulado), "S") == []


def test_h03_target_fuera_de_xl_se_ignora(tmp_path):
    import zipfile

    from app.domain.excel_parser import _xlsx_combinadas

    wb = Workbook()
    ws = wb.active
    ws.title = "S"
    ws["A1"] = "T"
    ws.merge_cells("A1:C1")
    normal = _guardar(wb, tmp_path, "normal2.xlsx")
    malo = tmp_path / "target.xlsx"
    with zipfile.ZipFile(normal) as entrada, zipfile.ZipFile(malo, "w") as salida:
        for item in entrada.infolist():
            datos = entrada.read(item.filename)
            if item.filename == "xl/_rels/workbook.xml.rels":
                datos = datos.replace(b"/xl/worksheets/sheet1.xml", b"../../x.xml")
                datos = datos.replace(b"worksheets/sheet1.xml", b"../../x.xml")
            salida.writestr(item, datos)
    assert _xlsx_combinadas(str(malo), "S") == []
