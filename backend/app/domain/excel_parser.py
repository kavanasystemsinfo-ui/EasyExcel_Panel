"""Lectura de Excel con timeout (ADR-0001). Compatible con serverless (sin multiprocessing).

Formatos de entrada: .xlsx (openpyxl), .xls (xlrd), .ods (odfpy), .csv (stdlib).
La exportación siempre genera .xlsx.

Detección de cabecera (ADR-0009): la fila 1 NO se asume cabecera. Se busca la
primera fila con >=2 celdas de texto distintas seguida de filas con datos,
tras saltar filas vacías y filas-título (una sola celda con texto). La
cabecera se devuelve como `header_row` (1-based, en la hoja original) en los
metadatos. Columnas con cabecera vacía se llaman "Columna N"; duplicados se
sufijan " (2)", " (3)".

Celdas combinadas: se rellena el valor de la celda ancla hacia abajo y a la
derecha (xlsx: ws.merged_cells; xls: sheet.merged_cells con
formatting_info=True; ods: numbercolumnsspanned/numberrowsspanned).

Límites con aviso (truncada): si una hoja supera max_columns o
max_rows_per_sheet se carga hasta el límite y se marca
`truncada: "columnas"|"filas"` en los metadatos en vez de rechazar el libro.
Solo se rechaza el libro entero si supera max_sheets o el tamaño máximo de
subida (éste último se controla en la capa HTTP).

Rendimiento (xlsx): la detección de cabecera y el relleno de celdas
combinadas necesitan leer valores y rangos combinados, así que se abandona
read_only=True. El coste es proporcional al tamaño real de la hoja y lo acota
el timeout `parse_timeout_s` (SIGALRM). En archivos grandes esto sube memoria
frente a read_only, pero es el precio de localizar la tabla real; el timeout
evita que el servicio se cuelgue.
"""

import csv as csv_mod
import posixpath
import re
import signal
import sys
import zipfile
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import xlrd
from odf import table as odf_table
from odf import teletype
from odf.opendocument import load as ods_load
from openpyxl import Workbook, load_workbook
from openpyxl.utils import range_boundaries

from app.core.config import settings
from app.errors import (
    InvalidWorkbookError,
    WorkbookLimitError,
    WorkbookNotFoundError,
    WorkbookParseTimeoutError,
)

FORMATOS_IMPORT = ("xlsx", "xls", "ods", "csv")

# Filas iniciales que se inspeccionan como máximo para localizar la cabecera.
_MAX_HEADER_SCAN = 50


class TimeoutError(Exception):
    """Timeout personalizado para el parser."""


def _timeout_handler(signum, frame):
    raise TimeoutError("Timeout")


def _cell(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (int, float, str, bool)):
        return value
    return str(value)


def _width(row: tuple[Any, ...]) -> int:
    width = len(row)
    while width > 0 and row[width - 1] is None:
        width -= 1
    return width


def _is_blank_row(row: list[Any]) -> bool:
    for c in row:
        v = _cell(c)
        if v not in ("", None):
            return False
    return True


def _row_text_cells(row: list[Any]) -> list[str]:
    """Texto normalizado (strip) de las celdas de texto no vacías."""
    out: list[str] = []
    for c in row:
        v = _cell(c)
        if isinstance(v, str) and v.strip():
            out.append(v.strip())
    return out


def _contar(row: list[Any]) -> int:
    return sum(1 for c in row if _cell(c) not in ("", None))


def _fila_cabecera(row: list[Any]) -> bool:
    """Fila con aspecto de cabecera: >=2 textos y casi todo lo que hay es texto."""
    textos = len(_row_text_cells(row))
    return textos >= 2 and textos >= 0.8 * _contar(row)


def _detect_header_row(rows: list[list[Any]]) -> int:
    """Índice (0-based) de la fila de cabecera dentro de `rows` (SIN celdas
    combinadas rellenadas: un título combinado a lo ancho es una sola celda).

    Se salta lo que no es tabla: filas vacías, títulos (menos de 2 textos) y
    filas mucho más estrechas que la tabla (menos de la mitad de celdas que la
    fila más ancha de las primeras). La primera fila con >=2 textos distintos
    seguida de filas con datos es la cabecera; si nada encaja, la fila 1.
    """
    if not rows:
        return 0
    limite = min(len(rows), _MAX_HEADER_SCAN)
    ancho_max = max((_contar(r) for r in rows[:limite]), default=0)
    for idx in range(limite):
        row = rows[idx]
        if _is_blank_row(row):
            continue
        textos = _row_text_cells(row)
        if len(set(textos)) < 2:
            continue
        if _contar(row) * 2 < ancho_max:
            continue
        siguientes = range(idx + 1, min(len(rows), idx + 5))
        if any(not _is_blank_row(rows[j]) for j in siguientes):
            return idx
    return 0


def _bloques(rows: list[list[Any]]) -> list[tuple[int, int]]:
    """Trozos de la hoja separados por filas vacías cuando lo que sigue empieza
    con una fila de cabecera (otra tabla). Una fila vacía suelta dentro de los
    datos no corta."""
    cortes: list[int] = []
    visto = False
    for i, row in enumerate(rows):
        if _is_blank_row(row):
            continue
        if (
            visto
            and _is_blank_row(rows[i - 1])
            and _fila_cabecera(row)
            and i + 1 < len(rows)
            and not _is_blank_row(rows[i + 1])
        ):
            cortes.append(i)
        visto = True
    limites = [0, *cortes, len(rows)]
    return [(limites[k], limites[k + 1]) for k in range(len(limites) - 1)]


def _hay_numeros(rows: list[list[Any]]) -> bool:
    return any(
        isinstance(c, (int, float)) and not isinstance(c, bool)
        for fila in rows
        for c in fila
    )


def _es_tabla(rows: list[list[Any]]) -> bool:
    llenas = [r for r in rows if not _is_blank_row(r)]
    return len(llenas) >= 2 and max((_contar(r) for r in llenas), default=0) >= 2


AVISO_VARIAS_TABLAS = "La hoja tiene varias tablas; se muestra la principal"
AVISO_HOJA_GRANDE = (
    "Hoja grande: no se rellenaron celdas combinadas ni se buscaron varias tablas"
)


def _rellenar_combinadas(
    rows: list[list[Any]],
    merges: list[tuple[int, int, int, int]],
    desde: int,
    hasta: int,
    max_cols: int,
) -> None:
    """Propaga el valor ancla de cada rango combinado (r0, r1, c0, c1 con fin
    exclusivo, base 0) dentro de [desde, hasta). Lo anterior a `desde` (títulos)
    no se toca."""
    for r0, r1, c0, c1 in merges:
        if r0 < desde or r0 >= hasta or c0 >= max_cols:
            continue
        ancla = rows[r0]
        valor = ancla[c0] if c0 < len(ancla) else None
        if valor in (None, ""):
            continue
        for rr in range(r0, min(r1, hasta)):
            fila = rows[rr]
            for cc in range(c0, min(c1, max_cols)):
                if rr == r0 and cc == c0:
                    continue
                while len(fila) <= cc:
                    fila.append(None)
                fila[cc] = valor


def _construir_tabla(
    rows: list[list[Any]], merges: list[tuple[int, int, int, int]], max_cols: int
) -> dict:
    """Localiza la tabla principal de la hoja y devuelve su cabecera y datos."""
    if not rows:
        return {"header": [], "data": [], "header_row": 1, "aviso": None, "cols": 0}
    bloques = _bloques(rows)
    pesos = [sum(_contar(r) for r in rows[a:b]) for a, b in bloques]
    a, b = bloques[pesos.index(max(pesos))]
    while b > a + 1 and _is_blank_row(rows[b - 1]):
        b -= 1
    tablas = sum(1 for x, y in bloques if _es_tabla(rows[x:y]))
    aviso = AVISO_VARIAS_TABLAS if tablas > 1 else None
    h = a + _detect_header_row(rows[a:b])
    # Cabecera de dos niveles: una fila de grupos con celdas combinadas a lo
    # ancho, justo encima o justo debajo de la fila de subcolumnas.
    def _con_combinadas(fila: int) -> bool:
        return any(r0 == fila and c1 - c0 > 1 for r0, _, c0, c1 in merges)

    # Solo si debajo hay datos con números: unos grupos combinados sobre filas
    # de puro texto no son una cabecera de dos niveles (H-01, 2.ª ronda).
    dos_niveles = (
        h + 1 < b
        and _con_combinadas(h)
        and _fila_cabecera(rows[h + 1])
        and _hay_numeros(rows[h + 2 : h + 7])
    )
    if (
        not dos_niveles
        and h - 1 >= a
        and _con_combinadas(h - 1)
        and _fila_cabecera(rows[h])
        and len(set(_row_text_cells(rows[h - 1]))) >= 2
        and _hay_numeros(rows[h + 1 : h + 6])
    ):
        dos_niveles = True
        h -= 1
    _rellenar_combinadas(rows, merges, h, b, max_cols)
    filas = rows[h:b]
    cols = min(max((_width(tuple(r)) for r in filas), default=0), max_cols)
    if dos_niveles:
        grupo, sub = filas[0], filas[1]
        ancho = max(cols, _width(tuple(grupo)), _width(tuple(sub)))
        crudo: list[Any] = []
        for c in range(ancho):
            g = _cell(grupo[c]) if c < len(grupo) else ""
            sv = _cell(sub[c]) if c < len(sub) else ""
            if g != "" and sv != "" and str(g) != str(sv):
                crudo.append(f"{g} · {sv}")
            else:
                crudo.append(sv or g)
        datos = filas[2:]
    else:
        crudo = [_cell(v) for v in filas[0]]
        ancho = max(cols, _width(tuple(filas[0])))
        datos = filas[1:]
    return {
        "header": _normalize_header(crudo, ancho),
        "data": datos,
        "header_row": h + 1,
        "aviso": aviso,
        "cols": cols,
    }


def _normalize_header(header_raw: list[Any], total_cols: int) -> list[str]:
    """Nombres finales de cabecera: vacíos -> "Columna N", duplicados -> " (2)"."""
    nombres: list[str] = []
    vistos: dict[str, int] = {}
    for i in range(total_cols):
        raw = header_raw[i] if i < len(header_raw) else ""
        nombre = str(raw).strip() if raw is not None else ""
        if not nombre:
            nombre = f"Columna {i + 1}"
        key = nombre.lower()
        if key in vistos:
            vistos[key] += 1
            nombre = f"{nombre} ({vistos[key]})"
        else:
            vistos[key] = 1
        nombres.append(nombre)
    return nombres


# --------------------------------------------------- formatos no xlsx
#
# El storage guarda siempre book.xlsx, asi que el formato se detecta por
# magic bytes y el nombre de la hoja del csv viene del nombre original.


OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _detect_format(path: str) -> str:
    with open(path, "rb") as fh:
        head = fh.read(8)
    if head.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(path) as archive:
                if "mimetype" in archive.namelist():
                    if b"opendocument.spreadsheet" in archive.read("mimetype"):
                        return "ods"
        except zipfile.BadZipFile:
            pass
        return "xlsx"
    if head.startswith(OLE2_MAGIC):
        return "xls"
    return "csv"


def _csv_number(valor: str, coma_decimal: bool) -> Any:
    texto = valor.strip()
    if not texto:
        return ""
    if re.fullmatch(r"-?\d+", texto):
        return int(texto)
    if coma_decimal and re.fullmatch(r"-?\d+,\d+", texto):
        return float(texto.replace(",", "."))
    if re.fullmatch(r"-?\d+\.\d+", texto):
        return float(texto)
    return valor


def _load_csv(path: str, nombre: str | None) -> list[dict]:
    data = Path(path).read_bytes()
    texto: str | None = None
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            texto = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if texto is None:
        texto = data.decode("latin-1", errors="replace")
    primera = next((linea for linea in texto.splitlines() if linea.strip()), "")
    delimitador = max((";", ",", "\t"), key=primera.count)
    coma_decimal = delimitador != ","
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    max_cols = settings.max_columns
    filas: list[list[Any]] = []
    truncada_cols = False
    for fila in csv_mod.reader(StringIO(texto), delimiter=delimitador):
        if len(fila) > max_cols:
            truncada_cols = True
        filas.append([_csv_number(c, coma_decimal) for c in fila[:max_cols]])
        if len(filas) >= max_filas:
            break
    hoja = Path(nombre).stem if nombre else "libro"
    return [
        {
            "name": hoja or "libro",
            "rows": filas,
            "truncada": "columnas" if truncada_cols else None,
        }
    ]


def _load_xls(path: str) -> list[dict]:
    # formatting_info=True habilita sheet.merged_cells (rangos (rlo,rhi,clo,chi)).
    # Coste: algo más de memoria por hoja; lo acota el timeout del parser.
    try:
        book = xlrd.open_workbook(path, formatting_info=True)
    except Exception:
        book = xlrd.open_workbook(path)
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    max_cols = settings.max_columns
    sheets: list[dict] = []
    for sh in book.sheets():
        merged = getattr(sh, "merged_cells", []) or []
        filas: list[list[Any]] = []
        truncada_cols = sh.ncols > max_cols
        for r in range(min(sh.nrows, max_filas)):
            fila: list[Any] = []
            for c in range(min(sh.ncols, max_cols)):
                cell = sh.cell(r, c)
                if cell.ctype == xlrd.XL_CELL_DATE:
                    dt = xlrd.xldate.xldate_as_datetime(cell.value, book.datemode)
                    fila.append(dt.isoformat())
                elif cell.ctype == xlrd.XL_CELL_NUMBER:
                    value = cell.value
                    fila.append(int(value) if value == int(value) else value)
                elif cell.ctype == xlrd.XL_CELL_BOOLEAN:
                    fila.append(bool(cell.value))
                elif cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
                    fila.append("")
                else:
                    fila.append(str(cell.value))
            filas.append(fila)
        combinadas = [
            (rlo, rhi, clo, chi) for rlo, rhi, clo, chi in merged if clo < max_cols
        ]
        sheets.append(
            {
                "name": sh.name,
                "rows": filas,
                "truncada": "columnas" if truncada_cols else None,
                "merges": combinadas,
            }
        )
    return sheets


def _ods_cell_value(node) -> Any:
    # odfpy expone las "clases" como factories: distinguir por qname.
    if node.qname[1] == "covered-table-cell":
        return ""
    valuetype = node.getAttribute("valuetype")
    if valuetype in ("float", "percentage", "currency"):
        raw = node.getAttribute("value")
        try:
            number = float(raw)
            return int(number) if number == int(number) else number
        except (TypeError, ValueError):
            return teletype.extractText(node)
    if valuetype == "boolean":
        return node.getAttribute("booleanvalue") == "true"
    if valuetype == "date":
        return node.getAttribute("datevalue") or teletype.extractText(node)
    return teletype.extractText(node)


def _load_ods(path: str) -> list[dict]:
    doc = ods_load(path)
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    max_cols = settings.max_columns
    sheets: list[dict] = []
    for tbl in doc.spreadsheet.getElementsByType(odf_table.Table):
        name = tbl.getAttribute("name") or "Hoja"
        filas: list[list[Any]] = []
        truncada_cols = False
        combinadas: list[tuple[int, int, int, int]] = []
        for row in tbl.getElementsByType(odf_table.TableRow):
            repeticiones = int(row.getAttribute("numberrowsrepeated") or 1)
            celdas: list[Any] = []
            col_idx = 0
            for node in row.childNodes:
                qname = getattr(node, "qname", None)
                if qname is None or qname[1] not in ("table-cell", "covered-table-cell"):
                    continue
                repeat = int(node.getAttribute("numbercolumnsrepeated") or 1)
                rowspan = colspan = 1
                if qname[1] == "table-cell":
                    rowspan = int(node.getAttribute("numberrowsspanned") or 1)
                    colspan = int(node.getAttribute("numbercolumnsspanned") or 1)
                value = _ods_cell_value(node)
                efectivas = min(repeat, max_cols - col_idx)
                if efectivas <= 0:
                    truncada_cols = True
                    break
                if repeat > efectivas:
                    truncada_cols = True
                if (rowspan > 1 or colspan > 1) and repeat == 1 and repeticiones == 1:
                    combinadas.append(
                        (len(filas), len(filas) + rowspan, col_idx, col_idx + colspan)
                    )
                for _ in range(efectivas):
                    celdas.append(value)
                col_idx += efectivas
            # LibreOffice rellena el final con filas vacias repetidas:
            # no materializar ese padding (dispararia falsos limites).
            if repeticiones > 1 and all(c == "" for c in celdas):
                continue
            for _ in range(min(repeticiones, max_filas - len(filas))):
                filas.append(list(celdas))
            if len(filas) >= max_filas:
                break
        sheets.append(
            {
                "name": name,
                "rows": filas,
                "truncada": "columnas" if truncada_cols else None,
                "merges": combinadas,
            }
        )
    return sheets


def _load_sheets(path: str, fmt: str, nombre: str | None) -> list[dict]:
    if fmt == "csv":
        return _load_csv(path, nombre)
    if fmt == "xls":
        return _load_xls(path)
    if fmt == "ods":
        return _load_ods(path)
    raise InvalidWorkbookError(f"Formato no soportado: .{fmt}")


def _metadata_from_rows(sheets: list[dict]) -> list[dict]:
    out: list[dict] = []
    for sheet in sheets:
        t = _construir_tabla(
            sheet["rows"], sheet.get("merges", []), settings.max_columns
        )
        n = len(t["data"])
        truncada = sheet.get("truncada")
        if not truncada and n > settings.max_rows_per_sheet:
            truncada = "filas"
        out.append(
            {
                "name": sheet["name"],
                "rows": min(n, settings.max_rows_per_sheet),
                "cols": t["cols"],
                "header_row": t["header_row"],
                "truncada": truncada,
                "aviso": t["aviso"],
            }
        )
    return out


def _pagina(t: dict, offset: int, limit: int) -> dict:
    header = t["header"]
    data = t["data"][: settings.max_rows_per_sheet]
    ancho = len(header)
    page = [[_cell(v) for v in row[:ancho]] for row in data[offset : offset + limit]]
    return {"header": header, "rows": page, "total": len(data)}


def _read_rows_from_sheets(
    sheets: list[dict], sheet: str, offset: int, limit: int
) -> dict:
    match = next((s for s in sheets if s["name"] == sheet), None)
    if match is None:
        raise WorkbookNotFoundError(f"La hoja '{sheet}' no existe")
    t = _construir_tabla(match["rows"], match.get("merges", []), settings.max_columns)
    return _pagina(t, offset, limit)


# ------------------------------------------------------------------ xlsx

# Hojas con más celdas que esto no se guardan enteras en memoria: se recorren en
# streaming (read_only), sin relleno de celdas combinadas ni búsqueda de varias
# tablas (H5 de la auditoría del PR #16: 4,4 M de celdas = 534 MB de RSS).
_CELDAS_RELLENO_MAX = 250_000
_FILAS_CABECERA = _MAX_HEADER_SCAN + 10

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_NS_PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"


@dataclass
class _Escaneo:
    head: list[list[Any]]
    todas: list[list[Any]] | None  # None si la hoja es demasiado grande
    n_filas: int
    ancho: int
    trunc_cols: bool
    trunc_filas: bool


def _xlsx_escanear(ws, max_filas: int, max_cols: int) -> _Escaneo:
    """Recorre una hoja en modo read_only. Guarda las filas enteras solo si la
    hoja es pequeña; si no, solo las primeras (para localizar la cabecera)."""
    ws.reset_dimensions()
    head: list[list[Any]] = []
    todas: list[list[Any]] | None = []
    celdas = 0
    ancho = 0
    n = 0
    ultima = -1
    trunc_cols = False
    trunc_filas = False
    for fila in ws.iter_rows(values_only=True):
        if n >= max_filas:
            trunc_filas = True
            break
        w = _width(fila)
        if w > max_cols:
            trunc_cols = True
        lista = list(fila[:max_cols])
        ancho = max(ancho, min(w, max_cols))
        if any(c not in (None, "") for c in lista):
            ultima = n
        if n < _FILAS_CABECERA:
            head.append(lista)
        if todas is not None:
            todas.append(lista)
            celdas += len(lista)
            if celdas > _CELDAS_RELLENO_MAX:
                todas = None
        n += 1
    if todas is not None:
        del todas[ultima + 1 :]
    return _Escaneo(head, todas, ultima + 1, ancho, trunc_cols, trunc_filas)


def _xml_seguro(datos: bytes) -> bool:
    """OOXML no lleva DTD: si aparece, el archivo se trata como manipulado."""
    cabecera = datos[:4096]
    return b"<!DOCTYPE" not in cabecera and b"<!ENTITY" not in cabecera


def _xlsx_combinadas(path: str, titulo: str) -> list[tuple[int, int, int, int]]:
    """Rangos combinados de una hoja leyendo solo la etiqueta <mergeCells> del
    XML (sin cargar la hoja). Formato (fila0, fila1, col0, col1), fin exclusivo."""
    try:
        with zipfile.ZipFile(path) as zf:
            datos_libro = zf.read("xl/workbook.xml")
            datos_rels = zf.read("xl/_rels/workbook.xml.rels")
            if not (_xml_seguro(datos_libro) and _xml_seguro(datos_rels)):
                return []
            libro = ET.fromstring(datos_libro)
            rid = next(
                (
                    h.get(_NS_REL + "id")
                    for h in libro.iter(_NS + "sheet")
                    if h.get("name") == titulo
                ),
                None,
            )
            rels = ET.fromstring(datos_rels)
            destino = next(
                (
                    r.get("Target")
                    for r in rels.iter(_NS_PKG + "Relationship")
                    if r.get("Id") == rid
                ),
                None,
            )
            if not rid or not destino:
                return []
            ruta = posixpath.normpath(
                destino.lstrip("/") if destino.startswith("/") else "xl/" + destino
            )
            if not ruta.startswith("xl/"):
                return []
            with zf.open(ruta) as fh:
                if not _xml_seguro(fh.read(4096)):
                    return []
            salida: list[tuple[int, int, int, int]] = []
            with zf.open(ruta) as fh:
                for _, el in ET.iterparse(fh, events=("end",)):
                    if el.tag == _NS + "mergeCell":
                        ref = el.get("ref")
                        if ref:
                            c0, r0, c1, r1 = range_boundaries(ref)
                            salida.append((r0 - 1, r1, c0 - 1, c1))
                    elif el.tag == _NS + "mergeCells":
                        break
                    elif el.tag == _NS + "row":
                        el.clear()
            return salida
    except (KeyError, ValueError, zipfile.BadZipFile, ET.ParseError):
        return []


def _xlsx_tabla(path: str, titulo: str, esc: _Escaneo) -> dict:
    if esc.todas is not None:
        merges = _xlsx_combinadas(path, titulo) if esc.todas else []
        t = _construir_tabla(esc.todas, merges, settings.max_columns)
        t["n_datos"] = len(t["data"])
        t["grande"] = False
        return t
    hdr = _detect_header_row(esc.head)
    cab = esc.head[hdr] if esc.head else []
    ancho = max(esc.ancho, _width(tuple(cab)))
    return {
        "header": _normalize_header([_cell(v) for v in cab], ancho),
        "data": [],
        "header_row": hdr + 1,
        "aviso": AVISO_HOJA_GRANDE,
        "cols": esc.ancho,
        "n_datos": max(esc.n_filas - hdr - 1, 0),
        "grande": True,
    }


def _extract_metadata_sync(path: str) -> list[dict]:
    """Metadatos de un xlsx en streaming (read_only)."""
    workbook = load_workbook(path, read_only=True, data_only=True)
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    sheets: list[dict] = []
    for ws in workbook.worksheets:
        esc = _xlsx_escanear(ws, max_filas, settings.max_columns)
        t = _xlsx_tabla(path, ws.title, esc)
        truncada = "columnas" if esc.trunc_cols else None
        if not truncada and (
            esc.trunc_filas or t["n_datos"] > settings.max_rows_per_sheet
        ):
            truncada = "filas"
        sheets.append(
            {
                "name": ws.title,
                "rows": min(t["n_datos"], settings.max_rows_per_sheet),
                "cols": t["cols"],
                "header_row": t["header_row"],
                "truncada": truncada,
                "aviso": t["aviso"],
            }
        )
    workbook.close()
    return sheets


def _read_rows_sync(path: str, sheet: str, offset: int, limit: int) -> dict:
    """Una página de filas de un xlsx. Hojas grandes: segunda pasada en
    streaming que solo guarda la página pedida."""
    workbook = load_workbook(path, read_only=True, data_only=True)
    if sheet not in workbook.sheetnames:
        workbook.close()
        raise WorkbookNotFoundError(f"La hoja '{sheet}' no existe")
    ws = workbook[sheet]
    max_filas = settings.max_rows_per_sheet + _MAX_HEADER_SCAN + 2
    esc = _xlsx_escanear(ws, max_filas, settings.max_columns)
    t = _xlsx_tabla(path, sheet, esc)
    if not t["grande"]:
        workbook.close()
        return _pagina(t, offset, limit)
    primera = t["header_row"] + offset  # índice base 0 de la primera fila pedida
    tope = min(esc.n_filas, t["header_row"] + settings.max_rows_per_sheet)
    ancho = len(t["header"])
    page: list[list[Any]] = []
    for i, fila in enumerate(ws.iter_rows(values_only=True)):
        if i >= tope or len(page) >= limit:
            break
        if i >= primera:
            page.append([_cell(v) for v in list(fila)[:ancho]])
    workbook.close()
    total = min(t["n_datos"], settings.max_rows_per_sheet)
    return {"header": t["header"], "rows": page, "total": total}


def _run_with_timeout(func, *args, timeout_s: float):
    """Ejecuta una función con timeout usando signal (solo Unix)."""
    if sys.platform == "win32":
        # Windows no tiene SIGALRM: se ejecuta sin timeout
        return func(*args)
    try:
        old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
        signal.setitimer(signal.ITIMER_REAL, timeout_s)
        try:
            result = func(*args)
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, old_handler)
        return result
    except (AttributeError, ValueError, OSError):
        # signal no disponible (Windows, o entorno restringido) -> sin timeout
        return func(*args)
    except TimeoutError as exc:
        raise WorkbookParseTimeoutError(
            "El archivo es demasiado grande para analizarlo, "
            "prueba a quitar columnas o hojas"
        ) from exc


def _check_limits(sheets: list[dict]) -> None:
    """Límite duro del LIBRO: nº de hojas. Las hojas anchas/largas se truncan
    con aviso (`truncada`) en vez de rechazarse (ADR-0009)."""
    if len(sheets) > settings.max_sheets:
        raise WorkbookLimitError(f"Maximo {settings.max_sheets} hojas por libro")


def _extract_metadata_generic(path: str, fmt: str, nombre: str | None) -> list[dict]:
    return _metadata_from_rows(_load_sheets(path, fmt, nombre))


def _read_rows_generic(
    path: str, fmt: str, nombre: str | None, sheet: str, offset: int, limit: int
) -> dict:
    return _read_rows_from_sheets(_load_sheets(path, fmt, nombre), sheet, offset, limit)


def extract_metadata(path: Path, nombre: str | None = None) -> list[dict]:
    fmt = _detect_format(str(path))
    if fmt == "xlsx":
        sheets = _run_with_timeout(
            _extract_metadata_sync, str(path), timeout_s=settings.parse_timeout_s
        )
    else:
        sheets = _run_with_timeout(
            _extract_metadata_generic,
            str(path), fmt, nombre,
            timeout_s=settings.parse_timeout_s,
        )
    _check_limits(sheets)
    return sheets


def read_rows(
    path: Path, sheet: str, offset: int, limit: int, nombre: str | None = None
) -> dict:
    fmt = _detect_format(str(path))
    if fmt == "xlsx":
        return _run_with_timeout(
            _read_rows_sync,
            str(path), sheet, offset, limit,
            timeout_s=settings.parse_timeout_s,
        )
    return _run_with_timeout(
        _read_rows_generic,
        str(path), fmt, nombre, sheet, offset, limit,
        timeout_s=settings.parse_timeout_s,
    )


# ------------------------------------------------------------------ export

_EXPORT_CELL_LIMIT = 32_767


def _export_scalar(value: Any) -> Any:
    if value is None or isinstance(value, (int, float, bool)):
        return value
    text = value if isinstance(value, str) else str(value)
    return text[:_EXPORT_CELL_LIMIT]


def build_export(header: list[str], rows: list[list[Any]]) -> bytes:
    if not header:
        raise InvalidWorkbookError("La exportacion necesita al menos una columna")
    if len(header) > settings.max_columns:
        raise WorkbookLimitError(f"Maximo {settings.max_columns} columnas por hoja")
    if len(rows) > settings.max_rows_per_sheet:
        raise WorkbookLimitError(f"Maximo {settings.max_rows_per_sheet} filas por hoja")
    if len(rows) * len(header) > settings.max_export_cells:
        raise WorkbookLimitError(
            f"Maximo {settings.max_export_cells} celdas por exportacion"
        )
    for index, row in enumerate(rows, start=2):
        if len(row) > len(header):
            raise WorkbookLimitError(
                f"La fila {index} tiene {len(row)} valores "
                f"y la cabecera {len(header)} columnas"
            )
    workbook = Workbook()
    sheet = workbook.active
    sheet.append([_export_scalar(cell) for cell in header])
    for row in rows:
        sheet.append([_export_scalar(cell) for cell in row])
    buf = BytesIO()
    workbook.save(buf)
    return buf.getvalue()