# EasyExcel Panel

**Dashboard de gestión sobre Excel para entornos donde el Excel es la base de datos.**

Caso de uso real que originó el proyecto: un encargado de personal de limpieza gestiona
varios centros (trabajadores, turnos, contratos, vacaciones, proveedores, auditorías y
maquinaria) repartidos entre varios archivos Excel dispersos. EasyExcel Panel busca
reunirlo todo en un dashboard moderno con edición, filtros, gráficos y asistencia IA,
sincronizado con los .xlsx que la empresa ya usa.

## Estado actual: Fase 1 (dataset + validación de coherencia)

| Componente | Estado |
|---|---|
| Dataset demo (9 hojas de negocio + Info) | **VERIFICADO** |
| Validador de coherencia del dataset | **VERIFICADO** (read-back independiente) |
| Excel en la nube de solo lectura | **DESPLEGADO** |
| Dashboard (upload, grid, edición, gráficos) | No implementado aún |

Lo que existe hoy es la **capa de datos** del producto: un Excel de demostración
completamente coherente y regenerable, pensado para servir de fuente al dashboard.

### Excel de demo en la nube (solo lectura)

https://drive.google.com/file/d/1pRZnz16rikA7Lq3vTwLr3RTElOuvvZQO/view

Cualquiera con el enlace puede verlo y descargarlo como `.xlsx`; nadie puede editarlo.

## Dataset

Generado por `scripts/generar_dataset_demo.py` (semilla fija, reproducible) desde
`data/empleados_demo.csv`.

| Hoja | Registros | Contenido |
|---|---|---|
| Info | — | Reglas de coherencia y procedencia |
| Empleados | 215 | Altas, bajas, contratos, turnos, pluses, estados |
| Centros | 7 | Cliente, dirección, zona, responsable, plantilla |
| Asignaciones | 249 | Historial empleado↔centro con rotaciones |
| Contratos | 215 | Tipo, jornada, vencimientos, prórrogas |
| Vacaciones | 336 | Peticiones 2026 con estados de aprobación |
| Proveedores | 18 | Servicio, contacto, pedidos 2026 |
| Auditorías | 39 | Puntuación, hallazgos, acciones correctivas |
| Maquinaria | 51 | Garantía, próxima revisión, proveedor |
| Revisiones | 97 | Revisiones preventivas/correctivas por equipo |

### Reglas de coherencia (verificadas por `scripts/verificar_dataset.py`)

- Estado `Baja` ⇔ fecha de baja ≤ fecha base (05/10/2026).
- Tipo de contrato (duración) separado de jornada (Completa/Parcial); parcial < 40 h.
- Salario base ≥ SMI proporcional: **1.221 €/mes en 14 pagas** (RD 126/2026, BOE 19/02/2026).
- Plus de turnicidad solo con turno rotativo; nocturnidad solo con turno de noche;
  penosidad solo con observación de altura o cristalería.
- Zona del empleado = zona de su centro de coste.
- Todo empleado no-baja tiene asignación vigente en su centro de coste.
- Vacaciones sin solapes y ≤ 30 días naturales por persona en 2026;
  estado `Vacaciones` implica estancia aprobada que cubre la fecha base.
- Próxima revisión de maquinaria > fecha base; última revisión ≤ fecha base.
- Auditorías: acción correctiva obligatoria si el resultado no es Conforme.
- Proveedores inactivos sin importes en 2026.

## Cómo reproducir

Requisitos: Python 3.11+ y `openpyxl`.

```bash
pip install openpyxl
python scripts/generar_dataset_demo.py   # genera data/easyexcel_demo.xlsx (semilla fija)
python scripts/verificar_dataset.py      # relee el xlsx y revalida todas las reglas
```

Salida esperada de la verificación: `READ-BACK OK: xlsx reabierto, 0 errores de coherencia`.

## Estructura

```
data/          empleados_demo.csv (base) · easyexcel_demo.xlsx (generado)
scripts/       generar_dataset_demo.py · verificar_dataset.py
```

## Roadmap

1. **Fase 1** — Investigación, setup y dataset ✅ (este repo)
2. **Fase 2** — Carga y visualización de Excel (upload, grid, selector de hojas)
3. **Fase 3** — Edición de celdas y guardado/exportación
4. **Fase 4** — Filtros, búsqueda y gráficos
5. **Fase 5** — Exportación PDF/Excel y pulido de UI
6. **Fase 6** — Autenticación y multiusuario (opcional)
7. **Fase 7** — Docker, despliegue y documentación final

Pendiente de decisión: stack definitivo de frontend/backend (Fase 1).

## Nota de privacidad

Todos los datos de este repositorio son **100 % sintéticos** (nombres, DNIs, teléfonos,
direcciones y empresas ficticios). No contienen datos reales de ninguna persona ni de
ninguna compañía. Los dominios usados (`empresa-limpieza.es`, `demo.easyexcel.local`)
son inventados.
