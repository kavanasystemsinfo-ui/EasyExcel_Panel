#!/usr/bin/env python3
"""
Descarga corpus de pruebas: 40-60 archivos Excel reales y desordenados.
- 15 oficiales (INE/datos.gob.es/Eurostat)
- 15 plantillas pyme (Vertex42, Microsoft, etc.)
- 20 muestra Enron/FUSE (Hermans)
Guarda en corpus_local/ (ignorado por .gitignore) y registra fuentes en FUENTES.md.
"""

import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests

CORPUS_DIR = Path(__file__).resolve().parents[1] / "corpus_local"
CORPUS_DIR.mkdir(parents=True, exist_ok=True)

FUENTES_FILE = CORPUS_DIR / "FUENTES.md"
METADATA_FILE = CORPUS_DIR / "metadata.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

TIMEOUT = 30
MAX_RETRIES = 2

# -----------------------------------------------------------------------------
# Fuentes oficiales (INE, datos.gob.es) - URLs directas que funcionan
# -----------------------------------------------------------------------------
OFICIALES = [
    # INE - Padrón municipal
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/33880.xlsx",
        "nombre": "ine_padron_municipal.xlsx",
        "fuente": "INE (Padrón Continuo - Población por sexo, municipios y nacionalidad)",
        "licencia": "CC BY 4.0 (INE Open Data)",
        "tipo": "oficial",
    },
    # INE - IPCA
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/67154.xlsx",
        "nombre": "ine_ipca_indices.xlsx",
        "fuente": "INE (Índices nacionales de secciones IPRX-M)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - Tasa empleo
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/67561.xlsx",
        "nombre": "ine_tasa_empleo.xlsx",
        "fuente": "INE (Tasa de empleo personas 20-64 años por sexo y nivel formativo)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - IPCA grupos especiales
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/67260.xlsx",
        "nombre": "ine_ipca_grupos_especiales.xlsx",
        "fuente": "INE (Índices nacionales de grupos especiales IPCA)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - Tasa bruta natalidad
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/67222.xlsx",
        "nombre": "ine_tasa_natalidad.xlsx",
        "fuente": "INE (Tasa bruta de natalidad por comunidad autónoma)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - Índices por actividad
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/67177.xlsx",
        "nombre": "ine_indices_actividad.xlsx",
        "fuente": "INE (Índices por actividad ICM)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - Viajeros
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/67186.xlsx",
        "nombre": "ine_viajeros.xlsx",
        "fuente": "INE (Personas viajeras por sexo, destino y duración)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - Suicidios
    {
        "url": "https://www.ine.es/jaxi/files/tpx/xlsx/76987.xlsx",
        "nombre": "ine_suicidios.xlsx",
        "fuente": "INE (Distribución de suicidios por medio, sexo y edad)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - Población edad quinquenales
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/33645.xlsx",
        "nombre": "ine_poblacion_edad.xlsx",
        "fuente": "INE (Población por sexo, municipios y edad quinquenales)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - Empresas condición jurídica
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/39371.xlsx",
        "nombre": "ine_empresas_condicion_juridica.xlsx",
        "fuente": "INE (Empresas por condición jurídica, actividad CNAE y estrato)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # INE - Empresas municipio
    {
        "url": "https://www.ine.es/jaxiT3/files/t/xlsx/4721.xlsx",
        "nombre": "ine_empresas_municipio.xlsx",
        "fuente": "INE (Empresas por municipio y actividad principal DIR)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # Eustat - Superficie forestal
    {
        "url": "https://www.eustat.eus/elementos/xls0004296_c.xlsx",
        "nombre": "eustat_superficie_forestal.xlsx",
        "fuente": "Eustat (Superficie forestal arbolada C.A. Euskadi)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # Renfe - Estaciones cercanías
    {
        "url": "https://data.renfe.com/dataset/aa5cf888-f8b9-4824-b60a-7ae3ba6ec32b/resource/2d65e7dc-ba44-466b-87e7-6dd949dd1749/download/listado-estaciones-cercanias-santander.xlsx",
        "nombre": "renfe_estaciones_santander.xlsx",
        "fuente": "Renfe (Estaciones Cercanías Santander - datos.gob.es)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # JuntaEx - Alojamientos rurales
    {
        "url": "https://www.juntaex.es/documents/77055/5801338/AlojamientosRurales.xlsx",
        "nombre": "juntaex_alojamientos_rurales.xlsx",
        "fuente": "Junta de Extremadura (Alojamientos rurales - datos.gob.es)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
    # Canarias - Establecimientos hoteleros
    {
        "url": "https://datos.canarias.es/catalogos/general/dataset/429db33d-cbce-4920-b1b6-b4dde9e5f90f/resource/eda77ef5-b5e3-4007-b10d-9b2b4906dd23/download/establecimientos-hoteleros-inscritos-en-el-registro-general-turistico-de-canarias.xlsx",
        "nombre": "canarias_hoteles.xlsx",
        "fuente": "Gobierno de Canarias (Hoteles inscritos - datos.gob.es)",
        "licencia": "CC BY 4.0",
        "tipo": "oficial",
    },
]

# -----------------------------------------------------------------------------
# Plantillas pyme - GitHub repos con plantillas públicas (URLs que funcionan)
# -----------------------------------------------------------------------------
PLANTILLAS = [
    # schnsrw/sheets - templates públicos
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/inventory.xlsx",
        "nombre": "github_sheets_inventario.xlsx",
        "fuente": "schnsrw/sheets (Inventory Template)",
        "licencia": "MIT (repo license)",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/invoice.xlsx",
        "nombre": "github_sheets_factura.xlsx",
        "fuente": "schnsrw/sheets (Invoice Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/expense-report.xlsx",
        "nombre": "github_sheets_gastos.xlsx",
        "fuente": "schnsrw/sheets (Expense Report Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/personal-budget.xlsx",
        "nombre": "github_sheets_presupuesto_personal.xlsx",
        "fuente": "schnsrw/sheets (Personal Budget Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/project-tracker.xlsx",
        "nombre": "github_sheets_proyecto.xlsx",
        "fuente": "schnsrw/sheets (Project Tracker Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/travel-planner.xlsx",
        "nombre": "github_sheets_viaje.xlsx",
        "fuente": "schnsrw/sheets (Travel Planner Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/class-schedule.xlsx",
        "nombre": "github_sheets_horario.xlsx",
        "fuente": "schnsrw/sheets (Class Schedule Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/grade-tracker.xlsx",
        "nombre": "github_sheets_notas.xlsx",
        "fuente": "schnsrw/sheets (Grade Tracker Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/meeting-notes.xlsx",
        "nombre": "github_sheets_reunion.xlsx",
        "fuente": "schnsrw/sheets (Meeting Notes Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/schnsrw/sheets/main/apps/web/public/templates/sprint-planner.xlsx",
        "nombre": "github_sheets_sprint.xlsx",
        "fuente": "schnsrw/sheets (Sprint Planner Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    # DevExpress demos-dashboard - MailMergeTemplates
    {
        "url": "https://raw.githubusercontent.com/DevExpress/demos-dashboard/main/Data/MailMergeTemplates/InvoiceTemplate.xlsx",
        "nombre": "devexpress_factura.xlsx",
        "fuente": "DevExpress (Invoice MailMerge Template)",
        "licencia": "MIT (repo license)",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/DevExpress/demos-dashboard/main/Data/MailMergeTemplates/EmployeesHorizontalTemplate.xlsx",
        "nombre": "devexpress_empleados.xlsx",
        "fuente": "DevExpress (Employees Horizontal Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/DevExpress/demos-dashboard/main/Data/MailMergeTemplates/FallCatalogTemplate.xlsx",
        "nombre": "devexpress_catalogo.xlsx",
        "fuente": "DevExpress (Fall Catalog Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/DevExpress/demos-dashboard/main/Data/MailMergeTemplates/MasterDetailTemplate.xlsx",
        "nombre": "devexpress_masterdetail.xlsx",
        "fuente": "DevExpress (Master Detail Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/DevExpress/demos-dashboard/main/Data/MailMergeTemplates/TableReportTemplate.xlsx",
        "nombre": "devexpress_tabla.xlsx",
        "fuente": "DevExpress (Table Report Template)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    # invoicemaker/invoice-templates
    {
        "url": "https://raw.githubusercontent.com/invoicemaker/invoice-templates/main/blank-invoice-template.xlsx",
        "nombre": "invoicemaker_factura_blanco.xlsx",
        "fuente": "invoicemaker/invoice-templates (Blank Invoice)",
        "licencia": "MIT (repo license)",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/invoicemaker/invoice-templates/main/simple-invoice-template.xlsx",
        "nombre": "invoicemaker_factura_simple.xlsx",
        "fuente": "invoicemaker/invoice-templates (Simple Invoice)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/invoicemaker/invoice-templates/main/service-invoice-template.xlsx",
        "nombre": "invoicemaker_factura_servicios.xlsx",
        "fuente": "invoicemaker/invoice-templates (Service Invoice)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/invoicemaker/invoice-templates/main/freelance-invoice-template.xlsx",
        "nombre": "invoicemaker_factura_freelance.xlsx",
        "fuente": "invoicemaker/invoice-templates (Freelance Invoice)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
    {
        "url": "https://raw.githubusercontent.com/invoicemaker/invoice-templates/main/hourly-invoice-template.xlsx",
        "nombre": "invoicemaker_factura_horas.xlsx",
        "fuente": "invoicemaker/invoice-templates (Hourly Invoice)",
        "licencia": "MIT",
        "tipo": "plantilla",
    },
]

# -----------------------------------------------------------------------------
# Enron Spreadsheets (SheetJS/enron_xls nuix subset) - archivos reales
# -----------------------------------------------------------------------------
ENRON_FILES = [
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/benjamin_rogers_000_1_1.pst.71.xls",
        "nombre": "enron_benjamin_rogers_71.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Benjamin Rogers)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/bill_williams_iii_000_1_1.pst.80.xls",
        "nombre": "enron_bill_williams_80.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Bill Williams III)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/brad_mckay_000_1_1.pst.11.xls",
        "nombre": "enron_brad_mckay_11.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Brad McKay)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/cara_semperger_000_1_1.pst.40.xls",
        "nombre": "enron_cara_semperger_40.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Cara Semperger)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/chris_germany_000_1_2.pst.1016.xls",
        "nombre": "enron_chris_germany_1016.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Chris Germany)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/chris_stokley_000_1_1.pst.173.xls",
        "nombre": "enron_chris_stokley_173.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Chris Stokley)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/dan_hyvl_000_1_1.pst.130.xls",
        "nombre": "enron_dan_hyvl_130.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Dan Hyvl)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/danny_mccarty_000_1_1.pst.10.xls",
        "nombre": "enron_danny_mccarty_10.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Danny McCarty)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/daren_farmer_000_1_1.pst.108.xls",
        "nombre": "enron_daren_farmer_108.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Daren Farmer)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/daren_farmer_000_1_1.pst.112.xls",
        "nombre": "enron_daren_farmer_112.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Daren Farmer)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.109.xls",
        "nombre": "enron_darrell_schoolcraft_109.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.136.xls",
        "nombre": "enron_darrell_schoolcraft_136.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.144.xls",
        "nombre": "enron_darrell_schoolcraft_144.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.145.xls",
        "nombre": "enron_darrell_schoolcraft_145.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.146.xls",
        "nombre": "enron_darrell_schoolcraft_146.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.147.xls",
        "nombre": "enron_darrell_schoolcraft_147.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.172.xls",
        "nombre": "enron_darrell_schoolcraft_172.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.173.xls",
        "nombre": "enron_darrell_schoolcraft_173.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.174.xls",
        "nombre": "enron_darrell_schoolcraft_174.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
    {
        "url": "https://raw.githubusercontent.com/SheetJS/enron_xls/master/nuix/darrell_schoolcraft_000_1_1_1.pst.195.xls",
        "nombre": "enron_darrell_schoolcraft_195.xls",
        "fuente": "Enron Corpus (SheetJS/enron_xls nuix - Darrell Schoolcraft)",
        "licencia": "CC0 1.0 Universal",
        "tipo": "enron",
    },
]

ALL_SOURCES = OFICIALES + PLANTILLAS + ENRON_FILES


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def download_file(url: str, dest: Path, max_retries: int = MAX_RETRIES) -> dict:
    """Descarga un archivo con reintentos y validación básica."""
    result = {
        "url": url,
        "destino": str(dest),
        "exito": False,
        "error": None,
        "bytes": 0,
        "sha256": None,
        "content_type": None,
    }

    for attempt in range(max_retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True, allow_redirects=True)
            resp.raise_for_status()

            content_type = resp.headers.get("Content-Type", "")
            result["content_type"] = content_type

            # Verificar que no sea HTML (página de error)
            if "text/html" in content_type.lower():
                first_chunk = next(resp.iter_content(1024), b"")
                if b"<html" in first_chunk.lower() or b"<!doctype" in first_chunk.lower():
                    result["error"] = f"Respuesta HTML (posible página de error/redirección). Content-Type: {content_type}"
                    continue

            total = 0
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        total += len(chunk)

            result["bytes"] = total
            result["sha256"] = sha256_file(dest)
            result["exito"] = True
            return result

        except requests.exceptions.Timeout:
            result["error"] = f"Timeout ({TIMEOUT}s)"
        except requests.exceptions.HTTPError as e:
            result["error"] = f"HTTP {e.response.status_code if e.response else '?'}"
        except requests.exceptions.RequestException as e:
            result["error"] = str(e)

        if attempt < max_retries:
            time.sleep(2 * (attempt + 1))

    return result


def validar_excel(path: Path) -> tuple[bool, str]:
    """Validación básica: magic bytes y que no esté vacío."""
    if not path.exists() or path.stat().st_size == 0:
        return False, "Archivo vacío o no existe"

    with open(path, "rb") as f:
        head = f.read(8)

    if head.startswith(b"PK\x03\x04"):
        return True, "xlsx"
    if head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return True, "xls"
    if head.startswith(b"PK\x03\x04"):
        return True, "ods_posible"
    if head[:3].decode("ascii", errors="ignore").isprintable():
        return True, "csv_posible"

    return False, f"Formato no reconocido (magic bytes: {head.hex()})"


def contiene_datos_personales_evidentes(path: Path) -> bool:
    """Heurística simple para detectar posibles datos personales."""
    try:
        with open(path, "rb") as f:
            sample = f.read(4096).decode("utf-8", errors="ignore").lower()

        pii_patterns = [
            r"\b\d{3}-\d{2}-\d{4}\b",  # SSN US
            r"\b\d{8}[A-Z]\b",  # DNI español
            r"\b[A-Z]{2}\d{6,}\b",  # NIE
            r"@[\w.-]+\.\w+",  # email
            r"\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b",  # tarjeta
        ]
        for pat in pii_patterns:
            if re.search(pat, sample):
                return True
    except Exception:
        pass
    return False


def cargar_metadata() -> list[dict]:
    if METADATA_FILE.exists():
        try:
            return json.loads(METADATA_FILE.read_text())
        except Exception:
            return []
    return []


def guardar_metadata(meta: list[dict]) -> None:
    METADATA_FILE.write_text(json.dumps(meta, indent=2, ensure_ascii=False))


def escribir_fuentes_md(meta: list[dict]) -> None:
    lines = [
        "# FUENTES DEL CORPUS DE PRUEBAS",
        "",
        f"Generado: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"Total archivos descargados: {len([m for m in meta if m.get('descargado')])}",
        "",
        "## Leyenda",
        "- ✅ = Descargado y validado",
        "- ❌ = Falló descarga o validación",
        "- ⚠️ = Descartado (datos personales / formato inválido)",
        "",
    ]

    for tipo, titulo in [
        ("oficial", "Oficiales (INE / datos.gob.es / Eurostat)"),
        ("plantilla", "Plantillas Pyme (GitHub, DevExpress, invoicemaker)"),
        ("enron", "Enron Spreadsheets (Hermans / FUSE)"),
    ]:
        lines.append(f"## {titulo}")
        lines.append("")
        for m in meta:
            if m.get("tipo") != tipo:
                continue
            estado = "✅" if m.get("validado") else ("⚠️" if m.get("descartado") else "❌")
            lines.append(f"- {estado} **{m['nombre']}** — {m['fuente']} — {m['licencia']}")
            lines.append(f"  - URL: {m['url']}")
            if m.get("error"):
                lines.append(f"  - Error: {m['error']}")
            if m.get("formato"):
                lines.append(f"  - Formato detectado: {m['formato']}")
            if m.get("tamano"):
                lines.append(f"  - Tamaño: {m['tamano']} bytes")
            lines.append("")
        lines.append("")

    FUENTES_FILE.write_text("\n".join(lines), encoding="utf-8")


def main():
    print(f"📁 Corpus dir: {CORPUS_DIR}")
    print(f"📄 FUENTES.md: {FUENTES_FILE}")

    metadata = cargar_metadata()
    existing_names = {m["nombre"] for m in metadata}

    descargados = 0
    fallados = 0
    descartados = 0

    for src in ALL_SOURCES:
        nombre = src["nombre"]
        if nombre in existing_names:
            print(f"  ⏭️  {nombre} — ya existe en metadata")
            continue

        dest = CORPUS_DIR / nombre
        print(f"  ⬇️  Descargando {nombre}...")

        result = download_file(src["url"], dest)

        entry = {
            "nombre": nombre,
            "url": src["url"],
            "fuente": src["fuente"],
            "licencia": src["licencia"],
            "tipo": src["tipo"],
            "descargado": result["exito"],
            "error": result["error"],
            "bytes": result["bytes"],
            "sha256": result["sha256"],
            "content_type": result["content_type"],
            "validado": False,
            "descartado": False,
            "formato": None,
            "tamano": None,
        }

        if result["exito"]:
            valido, fmt = validar_excel(dest)
            entry["formato"] = fmt
            entry["tamano"] = result["bytes"]

            if not valido:
                print(f"    ⚠️  Formato inválido: {fmt} — descartando")
                dest.unlink(missing_ok=True)
                entry["descargado"] = False
                entry["descartado"] = True
                entry["error"] = f"Formato inválido: {fmt}"
                descartados += 1
            elif contiene_datos_personales_evidentes(dest):
                print(f"    ⚠️  Posibles datos personales detectados — descartando")
                dest.unlink(missing_ok=True)
                entry["descargado"] = False
                entry["descartado"] = True
                entry["error"] = "Posibles datos personales (heurística)"
                descartados += 1
            else:
                print(f"    ✅  OK ({fmt}, {result['bytes']} bytes)")
                entry["validado"] = True
                descargados += 1
        else:
            print(f"    ❌  Falló: {result['error']}")
            fallados += 1

        metadata.append(entry)
        guardar_metadata(metadata)

    print("\n" + "=" * 50)
    print("RESUMEN DESCARGA")
    print("=" * 50)
    print(f"✅ Descargados y validados: {descargados}")
    print(f"❌ Fallados: {fallados}")
    print(f"⚠️  Descartados: {descartados}")
    print(f"📊 Total en metadata: {len(metadata)}")

    escribir_fuentes_md(metadata)
    print(f"\n📝 FUENTES.md actualizado en {FUENTES_FILE}")

    if descargados < 40:
        print("\n⚠️  ADVERTENCIA: Menos de 40 archivos válidos. Revisar fuentes.")
        sys.exit(1)


if __name__ == "__main__":
    main()