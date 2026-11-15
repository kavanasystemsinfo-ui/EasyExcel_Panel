"""Mide el pico de RAM de la exportacion a .xlsx (hallazgo H1 de la auditoria v0).

Uso (cada medida en un proceso limpio, para que el pico sea fiable):

    python scripts/medir_export.py antes 500000      # libro normal de openpyxl
    python scripts/medir_export.py despues 2000000   # write_only (el actual)

Referencia medida el 16-11-2026 (20 columnas):
    antes    2.000.000 celdas -> pico 798 MB
    despues  2.000.000 celdas -> pico 157 MB (149 MB son las propias filas)
"""

import resource
import sys
import time
from io import BytesIO

from openpyxl import Workbook

COLUMNAS = 20


def main(modo: str, celdas: int) -> None:
    header = [f"col{j}" for j in range(COLUMNAS)]
    filas = [
        [(f"valor {i} {j}" if j % 2 else i * 1.5) for j in range(COLUMNAS)]
        for i in range(celdas // COLUMNAS)
    ]
    base = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # las filas ya en RAM
    inicio = time.time()
    if modo == "antes":
        libro = Workbook()
        hoja = libro.active
    else:
        libro = Workbook(write_only=True)
        hoja = libro.create_sheet()
    hoja.append(header)
    for fila in filas:
        hoja.append(fila)
    libro.save(BytesIO())
    pico = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    print(
        f"{modo:8} celdas={celdas:>10,}  filas en RAM={base:5.0f} MB  "
        f"pico={pico:5.0f} MB  extra={pico - base:5.0f} MB  {time.time() - inicio:4.1f}s"
    )


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in {"antes", "despues"}:
        raise SystemExit(__doc__)
    main(sys.argv[1], int(sys.argv[2]))
