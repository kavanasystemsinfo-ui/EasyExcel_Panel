# EasyExcel Panel

**Dashboard de gestión sobre Excel para entornos donde el Excel es la base de datos.**

Caso de uso real que originó el proyecto: un encargado de personal de limpieza gestiona
varios centros (trabajadores, turnos, contratos, vacaciones, proveedores, auditorías y
maquinaria) repartidos entre varios archivos Excel dispersos. EasyExcel Panel busca
reunirlo todo en un dashboard moderno con edición, filtros, gráficos y asistencia IA,
sincronizado con los .xlsx que la empresa ya usa.

## Estado actual: Fase 4 (filtros, búsqueda y gráficos)

| Componente | Estado |
|---|---|
| Dataset demo (9 hojas de negocio + Info) | **VERIFICADO** |
| Validador de coherencia del dataset | **VERIFICADO** (read-back independiente) |
| Excel en la nube de solo lectura | **DESPLEGADO** |
| API de workbooks: carga, listado, detalle, filas, borrado y demo (6 endpoints) | **VERIFICADO** (20 tests + smoke con el dataset real) |
| Parsing de Excel aislado en subproceso con timeout y límites | **VERIFICADO** (test de timeout) |
| UI: dashboard operativo (sidebar, topbar, banner, grid paginado con badges) | **VERIFICADO** (89 tests Vitest) |
| KPIs calculados en cliente desde las hojas del propio Excel | **VERIFICADO** (14 tests de lógica pura + 3 de UI) |
| Paneles Cobertura por centro y Copiloto (IA pendiente) | **VERIFICADO** (E2E navegador con capturas) |
| Demo automática al entrar (libro sembrado en el servidor, sin subir nada) | **VERIFICADO** (E2E navegador) |
| Edición libre en cliente: celdas, filas y columnas con persistencia local | **VERIFICADO** (17 tests + E2E: persiste tras recarga) |
| Sesión local por visitante y botón "Restablecer" al original | **VERIFICADO** (E2E navegador con capturas) |
| Filtros por columna (valores con conteo y rango numérico) con chips quitables | **VERIFICADO** (12 tests + E2E: 215 → 30 filas y persistencia tras recarga) |
| Búsqueda global en todas las hojas con salto a la fila encontrada | **VERIFICADO** (6 tests + E2E: "pendiente" navega de Empleados a Vacaciones) |
| Gráficos de la hoja (barras y donut con selector de serie, recharts) | **VERIFICADO** (8 tests de series + E2E con SVG renderizado) |
| Vista persistente (hoja, filtros, búsqueda, página) en la sesión | **VERIFICADO** (tests de sesión + E2E tras recarga) |
| Tooling: ruff, mypy, pytest, oxlint, vitest | **VERIFICADO** (ejecución local) |
| CI en GitHub Actions (backend + frontend) | **VERIFICADO** (ambos jobs en verde) |
| IA real, exportación, multiusuario | No implementado aún |

El stack está decidido en [ADR-0001](docs/adr/0001-stack-y-arquitectura.md)
(React + TypeScript / FastAPI + openpyxl / PostgreSQL / Docker), la persistencia
de los Excel subidos en [ADR-0002](docs/adr/0002-persistencia-workbooks-fs.md)
(FS con manifest JSON, límites: 10 MB, 50 hojas, 200 columnas, 100.000 filas) y
la edición local de la Fase 3 en [ADR-0003](docs/adr/0003-sesion-local-demo.md)
(sessionStorage por visitante: se restablece al cerrar el navegador, sin JWT hasta que haya multiusuario).

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

## Desarrollo

```bash
# Backend (Python 3.11+)
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload        # API en http://localhost:8000
ruff check . && mypy app && pytest   # verificaciones

# Frontend (Node 24+) — con el backend levantado (proxy /api -> :8000 en dev)
cd frontend
npm install
npm run dev                          # UI en http://localhost:5173
npm run lint && npm test && npm run build
```

La documentación OpenAPI se genera automáticamente en `/docs` y `/openapi.json`.

## Estructura

```
backend/   FastAPI + Pydantic (app/), tests/ (pytest)
  app/api/       rutas y esquemas (workbooks, health)
  app/core/      configuración y storage (FS + manifest)
  app/domain/    excel_parser (subproceso con timeout)
frontend/  React + TypeScript con Vite (src/, tests con Vitest)
  src/edit.ts     motor de edición de hojas (puro, con límites)
  src/session.ts  sesión local por visitante (sessionStorage, se borra al cerrar)
boceto dashboard/  Boceto de UI de referencia (screen.png + DESIGN.md + code.html)
docs/adr/  Decisiones de arquitectura (0001: stack · 0002: persistencia FS · 0003: sesión local)
data/      empleados_demo.csv (base) · easyexcel_demo.xlsx (generado)
scripts/   generar_dataset_demo.py · verificar_dataset.py
.github/   CI: ruff + mypy + pytest · oxlint + vitest + build
```

## Roadmap

1. **Fase 1** — Investigación, setup y dataset ✅ (este repo)
2. **Fase 2** — Carga y visualización de Excel (upload, grid, selector de hojas) ✅
   - **UI de dashboard** (sidebar de hojas, 6 tarjetas KPI calculadas del propio .xlsx,
     grid con avatares/estados/paginador numérico, cobertura por centro y copiloto
     pendiente de IA) ✅
3. **Fase 3** — Demo automática y edición local ✅
   - Al entrar se carga el libro demo del servidor; cada visitante edita en su
     navegador (celdas, filas y columnas) con sesión en `sessionStorage` que se
     restablece sola al cerrar el navegador, y botón "Restablecer" al original
     (ADR-0003)
4. **Fase 4** — Filtros, búsqueda y gráficos ✅
   - Filtro por columna desde la cabecera de cada columna (valores con conteo
     o rango numérico), con chip quitable en la barra de herramientas;
     búsqueda global en todas las hojas con salto a la fila encontrada
     (resaltada 5 s); gráficos de la hoja activa (barras y donut con selector
     de serie, recharts); hoja, filtros, búsqueda y página quedan guardados en
     la vista de la sesión local y se restauran al recargar
5. **Fase 5** — Exportación PDF/Excel y pulido de UI
6. **Fase 6** — Autenticación y multiusuario (opcional)
7. **Fase 7** — Docker, despliegue y documentación final

## Nota de privacidad

Todos los datos de este repositorio son **100 % sintéticos** (nombres, DNIs, teléfonos,
direcciones y empresas ficticios). No contienen datos reales de ninguna persona ni de
ninguna compañía. Los dominios usados (`empresa-limpieza.es`, `demo.easyexcel.local`)
son inventados.
