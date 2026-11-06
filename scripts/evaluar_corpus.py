#!/usr/bin/env python3
"""
Evalúa el corpus de pruebas con el parser actual (extract_metadata y read_rows).
Genera corpus_local/informe.csv y un resumen con porcentajes.
"""

import csv
import json
import sys
import time
from pathlib import Path

# Añadir backend al path para importar el parser
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.domain.excel_parser import extract_metadata, read_rows
from app.errors import WorkbookParseTimeoutError, InvalidWorkbookError, WorkbookNotFoundError, WorkbookLimitError


CORPUS_DIR = Path(__file__).resolve().parents[1] / "corpus_local"
METADATA_FILE = CORPUS_DIR / "metadata.json"
INFORME_FILE = CORPUS_DIR / "informe.csv"


def evaluar_archivo(nombre_archivo: str) -> list[dict]:
    """Evalúa un archivo Excel y devuelve lista de resultados por hoja."""
    path = CORPUS_DIR / nombre_archivo
    resultados = []

    if not path.exists():
        return [{"archivo": nombre_archivo, "hoja": "N/A", "error": "Archivo no encontrado"}]

    # 1. extract_metadata
    t0 = time.perf_counter()
    try:
        sheets_meta = extract_metadata(path)
        tiempo_metadata = time.perf_counter() - t0
        error_metadata = None
    except WorkbookParseTimeoutError as e:
        tiempo_metadata = time.perf_counter() - t0
        error_metadata = f"TIMEOUT_METADATA: {e}"
        sheets_meta = []
    except (InvalidWorkbookError, WorkbookLimitError, WorkbookNotFoundError) as e:
        tiempo_metadata = time.perf_counter() - t0
        error_metadata = f"ERROR_METADATA: {type(e).__name__}: {e}"
        sheets_meta = []
    except Exception as e:
        tiempo_metadata = time.perf_counter() - t0
        error_metadata = f"EXCEPCION_METADATA: {type(e).__name__}: {e}"
        sheets_meta = []

    if error_metadata:
        # Si falló metadata, no podemos leer hojas
        resultados.append({
            "archivo": nombre_archivo,
            "hoja": "N/A",
            "formato": "N/A",
            "n_hojas": 0,
            "filas": 0,
            "columnas": 0,
            "cabecera_detectada": "N/A",
            "cabecera_parece_titulo": "N/A",
            "cols_nombre_vacio": 0,
            "cols_nombre_duplicado": 0,
            "error": error_metadata,
            "timeout": "TIMEOUT" in error_metadata,
            "tiempo_parseo_s": round(tiempo_metadata, 3),
        })
        return resultados

    # 2. Para cada hoja, read_rows con offset=0, limit=10 (para ver cabecera + primeras filas)
    for sheet_meta in sheets_meta:
        sheet_name = sheet_meta["name"]
        n_rows = sheet_meta["rows"]
        n_cols = sheet_meta["cols"]

        t1 = time.perf_counter()
        try:
            read_result = read_rows(path, sheet_name, offset=0, limit=10)
            tiempo_read = time.perf_counter() - t1
            error_read = None
            header = read_result["header"]
            data_rows = read_result["rows"]
        except WorkbookParseTimeoutError as e:
            tiempo_read = time.perf_counter() - t1
            error_read = f"TIMEOUT_READ: {e}"
            header = []
            data_rows = []
        except (InvalidWorkbookError, WorkbookLimitError, WorkbookNotFoundError) as e:
            tiempo_read = time.perf_counter() - t1
            error_read = f"ERROR_READ: {type(e).__name__}: {e}"
            header = []
            data_rows = []
        except Exception as e:
            tiempo_read = time.perf_counter() - t1
            error_read = f"EXCEPCION_READ: {type(e).__name__}: {e}"
            header = []
            data_rows = []

        # Analizar cabecera (primera fila)
        cabecera_str = "|".join(str(h) if h is not None else "" for h in header)
        
        # ¿Parece título? (una sola celda con texto, o >50% celdas vacías)
        celdas_no_vacias = sum(1 for h in header if h not in (None, "", "None"))
        total_celdas = len(header)
        cabecera_parece_titulo = False
        if total_celdas > 0:
            if celdas_no_vacias == 1 and total_celdas > 1:
                cabecera_parece_titulo = True
            elif celdas_no_vacias / total_celdas < 0.5:
                cabecera_parece_titulo = True

        # Columnas con nombre vacío o duplicado
        nombres = [str(h) if h is not None else "" for h in header]
        cols_vacias = sum(1 for n in nombres if not n.strip())
        
        # Duplicados (case-insensitive, ignorando vacíos)
        vistos = {}
        cols_duplicadas = 0
        for n in nombres:
            n_lower = n.strip().lower()
            if n_lower:
                if n_lower in vistos:
                    cols_duplicadas += 1
                else:
                    vistos[n_lower] = 1

        resultados.append({
            "archivo": nombre_archivo,
            "hoja": sheet_name,
            "formato": path.suffix.lower().lstrip("."),
            "n_hojas": len(sheets_meta),
            "filas": n_rows,
            "columnas": n_cols,
            "cabecera_detectada": cabecera_str[:500],  # truncar para CSV
            "cabecera_parece_titulo": "SI" if cabecera_parece_titulo else "NO",
            "cols_nombre_vacio": cols_vacias,
            "cols_nombre_duplicado": cols_duplicadas,
            "error": error_read or "",
            "timeout": "TIMEOUT" in (error_read or ""),
            "tiempo_parseo_s": round(tiempo_metadata + tiempo_read, 3),
        })

    return resultados


def main():
    # Cargar metadata para saber qué archivos evaluar
    if not METADATA_FILE.exists():
        print("❌ No existe metadata.json. Ejecuta primero descargar_corpus.py")
        sys.exit(1)

    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    # Filtrar solo archivos validados
    archivos = [m["nombre"] for m in metadata if m.get("validado")]

    print(f"📊 Evaluando {len(archivos)} archivos...")

    all_results = []
    for i, nombre in enumerate(archivos, 1):
        print(f"  [{i}/{len(archivos)}] {nombre}...")
        resultados = evaluar_archivo(nombre)
        all_results.extend(resultados)

    # Escribir CSV
    fieldnames = [
        "archivo", "hoja", "formato", "n_hojas", "filas", "columnas",
        "cabecera_detectada", "cabecera_parece_titulo", "cols_nombre_vacio",
        "cols_nombre_duplicado", "error", "timeout", "tiempo_parseo_s"
    ]

    with open(INFORME_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_results)

    print(f"\n✅ Informe guardado en {INFORME_FILE}")

    # Generar resumen
    total_hojas = len(all_results)
    if total_hojas == 0:
        print("⚠️ No hay resultados para resumir")
        return

    # % cabecera fila 1 claramente incorrecta (parece título)
    cabeceras_titulo = sum(1 for r in all_results if r["cabecera_parece_titulo"] == "SI")
    pct_titulo = cabeceras_titulo / total_hojas * 100

    # Errores y timeouts
    errores = [r for r in all_results if r["error"]]
    timeouts = [r for r in all_results if r["timeout"]]
    lentos = [r for r in all_results if r["tiempo_parseo_s"] > 5.0]

    # Top 5 tipos de fallo
    from collections import Counter
    fallos = Counter()
    for r in all_results:
        if r["error"]:
            # Clasificar tipo de error
            err = r["error"]
            if "TIMEOUT" in err:
                fallos["Timeout"] += 1
            elif "InvalidWorkbookError" in err:
                fallos["Formato inválido"] += 1
            elif "WorkbookLimitError" in err:
                fallos["Límite excedido (filas/cols/hojas)"] += 1
            elif "WorkbookNotFoundError" in err:
                fallos["Hoja no encontrada"] += 1
            else:
                fallos["Otro error"] += 1

    # Top 5 fallos con 3 ejemplos cada uno
    top_fallos = fallos.most_common(5)
    ejemplos_por_fallo = {}
    for r in all_results:
        if r["error"]:
            err = r["error"]
            if "TIMEOUT" in err:
                tipo = "Timeout"
            elif "InvalidWorkbookError" in err:
                tipo = "Formato inválido"
            elif "WorkbookLimitError" in err:
                tipo = "Límite excedido"
            elif "WorkbookNotFoundError" in err:
                tipo = "Hoja no encontrada"
            else:
                tipo = "Otro error"
            
            if tipo not in ejemplos_por_fallo:
                ejemplos_por_fallo[tipo] = []
            if len(ejemplos_por_fallo[tipo]) < 3:
                ejemplos_por_fallo[tipo].append(f"{r['archivo']} / {r['hoja']}")

    # Archivos con error o >5s
    archivos_problema = {}
    for r in all_results:
        if r["error"] or r["tiempo_parseo_s"] > 5.0:
            if r["archivo"] not in archivos_problema:
                archivos_problema[r["archivo"]] = []
            archivos_problema[r["archivo"]].append(
                f"  hoja={r['hoja']} error={r['error'][:80] if r['error'] else ''} tiempo={r['tiempo_parseo_s']}s"
            )

    # Imprimir resumen
    print("\n" + "=" * 60)
    print("RESUMEN EVALUACIÓN")
    print("=" * 60)
    print(f"Total hojas evaluadas: {total_hojas}")
    print(f"Archivos evaluados: {len(archivos)}")
    print(f"\n📋 Cabecera fila 1 parece título (claramente incorrecta): {cabeceras_titulo}/{total_hojas} ({pct_titulo:.1f}%)")
    print(f"\n❌ Hojas con error: {len(errores)}")
    print(f"⏱️  Hojas con timeout: {len(timeouts)}")
    print(f"🐢 Hojas >5s: {len(lentos)}")

    print(f"\n🔴 TOP 5 TIPOS DE FALLO:")
    for tipo, count in top_fallos:
        print(f"  {tipo}: {count}")
        for ej in ejemplos_por_fallo.get(tipo, []):
            print(f"    - {ej}")

    print(f"\n📁 ARCHIVOS CON ERRORES O >5s:")
    for arch, detalles in sorted(archivos_problema.items()):
        print(f"  {arch}:")
        for d in detalles:
            print(d)

    # Fuentes que no descargaron (del metadata)
    fallidos_descarga = [m for m in metadata if not m.get("validado") and not m.get("descartado")]
    if fallidos_descarga:
        print(f"\n📥 FUENTES QUE NO DESCARGARON ({len(fallidos_descarga)}):")
        for m in fallidos_descarga:
            print(f"  - {m['nombre']}: {m.get('error', 'desconocido')}")


if __name__ == "__main__":
    main()