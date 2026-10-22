# ADR-0005: Entrada multi-formato (.xlsx, .xls, .ods, .csv)

- **Estado**: Aceptado
- **Fecha**: 21/10/2026
- **Decisor**: Jorge (con recomendación técnica de Elias)

## Contexto

El parser solo abría `.xlsx` (openpyxl). En el terreno real los libros llegan
de Excel 97-2003 (`.xls`), LibreOffice/Google Sheets exportado a `.ods` y
volcados planos (`.csv`): rechazarlos obligaba a convertir a mano antes de
subir. Cualquier formato que entre debe heredar **todos** los límites y el
aislamiento del parser original (ADR-0001), porque ampliar formatos amplía la
superficie de ataque del parser.

## Decisión

| Aspecto | Elección |
|---|---|
| Detección | magic bytes del fichero, no la extensión (la extensión se valida además, pero manda el contenido) |
| `.xlsx` | openpyxl (sin cambios) |
| `.xls` | `xlrd>=2.0` (solo lectura de hojas y valores) |
| `.ods` | `odfpy` |
| `.csv` | csv stdlib con sniffing de delimitador (`;`, `,`, tab), coma decimal convertida a punto y codificación utf-8-sig → cp1252 → latin-1 |
| Nombre de hoja | el stem del fichero para CSV |
| Almacenamiento | siempre se guarda como `book.xlsx` en el storage; el formato original no colorea el resto del sistema |
| Límites | los mismos del ADR-0001 (10 MB, 50 hojas, 200 columnas, 100.000 filas) y la misma ventana de timeout, **incluidos los tests** |
| Export | siempre `.xlsx` (openpyxl); el multi-formato es solo de entrada |

Detalles que costaron: el padding de filas vacías que LibreOffice escribe en el
ODS no se materializa (disparaba falsos límites de filas); y `xlrd`/`odfpy`
tienen que estar en `pyproject.toml`, no solo en `requirements.txt`, porque el
parser los importa a nivel de módulo y el CI instala `.[dev]`.

## Alternativas consideradas

- **Pedir al usuario que convierta a `.xlsx`**: rechazado; el formato del
  cliente no debería ser trabajo del cliente.
- **LibreOffice headless en el servidor para unificar a `.xlsx`**: rechazado
  por peso, arranque frío y una superficie de ataque enorme en un servicio
  con uploads anónimos.

## Consecuencias

- **+** Cualquier libro razonable entra sin pasos previos; el frontend solo
  amplía el `accept` del input de ficheros.
- **+** Una sola puerta de entrada (detección por magic) y los mismos límites
  para todos los formatos, verificados por los mismos tests (`test_import.py`).
- **−** Dependencias extra (`xlrd`, `odfpy`) y un dispatch por formato que hay
  que mantener al añadir cualquiera nuevo.
- **−** El CSV no tiene estructura de hoja: se trata como una única hoja plana
  y no valida columnas por tipo.
