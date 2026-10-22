# EasyExcel Panel

[![CI](https://github.com/kavanasystemsinfo-ui/EasyExcel_Panel/actions/workflows/ci.yml/badge.svg)](https://github.com/kavanasystemsinfo-ui/EasyExcel_Panel/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

**Dashboard de gestión sobre Excel para entornos donde el Excel es la base de datos.**

> **Demo en vivo**: <https://easyexcel.kavanasystems.com>
> Abre con un dataset de muestra generado en el servidor, sube tu propio
> `.xlsx`, filtra, edita, exporta a Excel/PDF y pregúntale al copiloto IA.

Caso de uso: gestión de personal y operaciones multi-centro con el Excel como
base de datos (trabajadores, turnos, contratos, vacaciones, proveedores,
auditorías y maquinaria repartidos entre varios ficheros dispersos). El
proyecto nació observando un caso real de este tipo en el sector servicios;
hoy el demo en vivo presenta una planta cerámica sintética, en línea con el
foco industrial de Kavana Systems (ADR-0008). EasyExcel Panel busca reunirlo
todo en un dashboard moderno con edición, filtros, gráficos y asistencia IA,
sincronizado con los .xlsx que la empresa ya usa.

## Estado actual (22/10/2026) — Fase 7 desplegada

| Componente | Estado |
|---|---|
| Demo en vivo en producción (Render + dominio propio) | **DESPLEGADO** (<https://easyexcel.kavanasystems.com>) |
| Dataset demo del servidor (9 hojas de negocio + Info, semilla fija, planta cerámica) | **VERIFICADO** (tests de sector, ADR-0008) |
| API: 9 endpoints (7 de workbooks + `/health` + copiloto) | **VERIFICADO** (76 tests pytest + smoke con el dataset real) |
| Parsing multi-formato (.xlsx/.xls/.ods/.csv) aislado en subproceso con timeout y límites | **VERIFICADO** (ADR-0005) |
| Subidas efímeras con caducidad de 2 h | **VERIFICADO** (ADR-0004, tests de purga) |
| UI: dashboard operativo (sidebar, topbar, banner, grid paginado con badges) | **VERIFICADO** (suite frontend: 197 tests Vitest) |
| Navegación por 4 vistas (Resumen, Personal, Operaciones, Datos) con KPIs, gráficos y hojas por dominio | **VERIFICADO** (tests de `views.ts` + E2E de navegación) |
| Vista Resumen: 6 KPIs del día + alertas del día, sin tabla | **VERIFICADO** (E2E con capturas) |
| Scroll del dashboard con rueda y barra siempre visible (fix de app shell) | **VERIFICADO** (E2E: `scrollTop` 0 → 460 con la rueda) |
| Export .xlsx de la hoja activa con filtros, búsqueda y columnas visibles aplicados | **VERIFICADO** (10 tests + E2E: descarga `easyexcel_demo_Empleados.xlsx` de 9.177 bytes) |
| Export PDF vía `window.print()` con CSS de impresión: cabecera compacta (panel, hoja, fecha, filtros) y **datos en la página 1**; sin banner, copiloto ni KPIs cuando hay tabla | **VERIFICADO** (PDF regenerado con Playwright y auditado con pymupdf: 2 páginas, cero páginas vacías y cero texto de paja) |
| Menú "Exportar" (Excel/PDF) en topbar y toolbar, con estado "Generando…" y Excel deshabilitado en Resumen | **VERIFICADO** (6 tests de UI + E2E) |
| Menú de filtro de columna en portal `body` (no se recorta con pocas filas) | **VERIFICADO** (E2E: `position: fixed`, cabida en viewport con 1 fila) |
| KPIs calculados en cliente desde las hojas del propio Excel | **VERIFICADO** (14 tests de lógica pura + 3 de UI) |
| Paneles Cobertura por centro (en Operaciones) y Asistente IA (arriba, colapsable, degradado azul) | **VERIFICADO** (E2E navegador con capturas) |
| Demo automática al entrar (libro sembrado en el servidor, sin subir nada) | **VERIFICADO** (E2E navegador) |
| Edición libre en cliente: celdas, filas y columnas con persistencia local | **VERIFICADO** (17 tests + E2E: persiste tras recarga) |
| Sesión local por visitante y botón "Restablecer" al original | **VERIFICADO** (E2E navegador con capturas) |
| Filtros por columna (valores con conteo y rango numérico) con chips quitables | **VERIFICADO** (12 tests + E2E: 215 → 30 filas y persistencia tras recarga) |
| Búsqueda global en todas las hojas con salto a la fila encontrada | **VERIFICADO** (6 tests + E2E: "pendiente" navega a Vacaciones) |
| Gráficos por dominio (barras y donut con selector de serie, recharts) | **VERIFICADO** (8 tests de series + E2E con SVG renderizado) |
| Vista persistente (sección, hoja, filtros, búsqueda, página) en la sesión | **VERIFICADO** (tests de sesión + E2E tras recarga) |
| Tooling: ruff, mypy, pytest, oxlint, vitest | **VERIFICADO** (ejecución local) |
| CI en GitHub Actions (backend + frontend) | **VERIFICADO** (badge en verde en cada push a `main`) |
| Asistente IA: preguntas en lenguaje natural con contexto anclado (KPIs, alertas, conteos por columna y muestra filtrada), streaming SSE, cadena de respaldo de modelos gratuitos (OpenRouter → NVIDIA), rate limit de 20 consultas/día por IP y caché de preguntas repetidas | **VERIFICADO** (tests backend de `test_copiloto.py` + 13 tests del panel + E2E real: "¿Cuántos de vacaciones hoy?" → "15 empleados" = `kpis.vacaciones.hoy`) |
| Panel Asistente IA arriba del todo (tras el banner), con cabecera colapsable (desplegar/ocultar, persistida en `localStorage`) y fondo degradado azul → azul oscuro; sin botón propio en el topbar | **VERIFICADO** (tests de UI + E2E: título, `aria-expanded`, degradado, persistencia) |
| Respuesta del copiloto con markdown escapado (anti-XSS) | **VERIFICADO** (3 tests de DOM: el HTML del modelo no se inyecta) |
| Botón "F" (Buscar) en la toolbar: abre un campo de búsqueda manual de cualquier dato en la hoja activa; con búsqueda activa queda pulsado y al volver a pulsarla limpia | **VERIFICADO** (4 tests de UI + E2E: 7 → 1 filas con "Bogot" → 7 al limpiar) |
| Menú de filtro de columna reposicionado para abrir hacia arriba o recortarse cuando no cabe en el viewport | **VERIFICADO** (4 tests de posicionamiento + E2E de filtro con recorte) |
| Auth y multiusuario | **PENDIENTE** (Fase 8) |

Las decisiones están documentadas en [ARCHITECTURE.md](ARCHITECTURE.md) y en los
ADR de [`docs/adr/`](docs/adr/): [0001 stack](docs/adr/0001-stack-y-arquitectura.md) ·
[0002 persistencia FS](docs/adr/0002-persistencia-workbooks-fs.md) ·
[0003 sesión local](docs/adr/0003-sesion-local-demo.md) ·
[0004 subidas con TTL](docs/adr/0004-subidas-efimeras-ttl.md) ·
[0005 formatos de entrada](docs/adr/0005-formatos-entrada-xls-ods-csv.md) ·
[0006 rate limit del copiloto](docs/adr/0006-copiloto-rate-limit-20-dia.md) ·
[0007 acceso abierto sin auth](docs/adr/0007-acceso-abierto-sin-autenticacion.md) ·
[0008 sector del demo](docs/adr/0008-sector-del-demo-ceramico.md).

### Asistente IA (modelos gratuitos)

`POST /api/v1/copiloto` recibe `{pregunta, contexto}` y responde por **SSE**
(eventos `delta` → `fin`, o `error`). El proveedor se decide en el servidor y
la cadena es configurable por variables de entorno; por defecto:

| Orden | Proveedor | Modelos |
|---|---|---|
| 1 | OpenRouter | `google/gemma-4-31b-it:free` → `cohere/north-mini-code:free` |
| 2 | NVIDIA NIM (respaldo por cuota agotada en OpenRouter) | `google/gemma-4-31b-it` |

- **Contexto anclado**: el frontend envía hoja, sección, filtros activos, KPIs,
  alertas, conteos por columna (máx. 8 columnas categóricas con ≤40 valores) y
  una muestra de 15 filas filtradas; el system prompt prohíbe inventar números
  y manda reproducir los del contexto. Máximo 60.000 caracteres serializados.
- **Resumen del día**: ante preguntas genéricas ("¿Cómo va el día?", "qué hay que
  gestionar", "estado general") el system prompt manda responder con (1) estado
  general del día en una frase con datos concretos, (2) acciones más importantes
  o urgentes (máx. 3, con su dato y por qué es urgente) y (3) puntos no críticos
  que requieren atención, ordenados por urgencia.
- **Sugerencias rápidas**: la primera es "¿Cómo va el día?"; le siguen "¿Qué
  necesito gestionar hoy?", "¿Qué alertas hay abiertas?", "¿Quién está de
  vacaciones hoy?", "¿Qué centro tiene más huecos?" y "Muéstrame revisiones
  vencidas".
- **Protecciones** (ADR-0006): 20 consultas / día por IP real (última IP de
  `X-Forwarded-For`, la que añade el proxy), caché de 200 preguntas idénticas,
  `max_tokens` 1.500 y timeout de 90 s; sin ninguna clave configurada responde
  `503`; logging de cada intento (`easyexcel.copiloto`).
- **Claves**: `backend/.env` (gitignorado) con `EASYEXCEL_OPENROUTER_API_KEY`
  y `EASYEXCEL_NVIDIA_API_KEY`; ver `backend/.env.example`.
- **Privacidad**: la UI avisa que se usan modelos gratuitos externos para
  datos demo y que no debe subirse información personal real; solo viajan la
  pregunta y el resumen calculado, nunca el Excel completo.

### Excel de demo en la nube (solo lectura)

https://drive.google.com/file/d/1pRZnz16rikA7Lq3vTwLr3RTElOuvvZQO/view

Cualquiera con el enlace puede verlo y descargarlo como `.xlsx`; nadie puede editarlo.

## Seguridad y límites

| Control | Valor |
|---|---|
| Upload | 10 MB leídos en bloques de 1 MB (413 al primer bloque que desborda), validación extensión + magic bytes, **30 subidas/hora por IP** (429 antes de leer el body) |
| Estructura del libro | 50 hojas · 200 columnas · 100.000 filas · 2.000.000 celdas de export |
| Parseo | subproceso con timeout, nunca en el hilo de la petición |
| Caducidad | los Excel subidos caducan a las 2 h y se purgan en cada operación (el demo no caduca) |
| Copiloto | 20/día por IP, caché 200, sin claves → 503 |
| HTML del copiloto | todo el texto del modelo se escapa antes del markdown (`frontend/src/copilotoRender.ts`) |
| CORS | en producción todo es mismo origen vía proxy `/api`; allowlist explícita en dev |
| Swagger | `/docs` y `/openapi.json` **desactivados en Render** (activos en local; `EASYEXCEL_DOCS_ENABLED` fuerza el valor) |
| Dependencias | Dependabot semanal (pip, npm, github-actions) + `npm audit` sin vulnerabilidades |
| Datos | **100 % sintéticos**; sin autenticación todavía: no subir información real |

## Datasets

El proyecto convive con dos datasets, ambos reproducibles:

### Demo en vivo (la que carga la web)

Generada por `backend/app/core/demo.py` con semilla fija (`20261020`): 50
empleados y 9 hojas de negocio (Empleados, Centros, Asignaciones, Contratos,
Vacaciones, Proveedores, Auditorías, Maquinaria, Revisiones) + Info, con
temática de planta cerámica sintética (`Cerámica Turia S.A.`, decisión en el
ADR-0008). El backend la sirve con `GET /api/v1/workbooks/demo` y la UI la
carga sola al entrar, sin subir nada.

### Dataset original de desarrollo (215 empleados, sector limpieza, histórico)

Es el dataset con el que se construyó el proyecto y se mantiene como
referencia histórica; el demo en vivo no lo usa. Generado por
`scripts/generar_dataset_demo.py` (semilla fija, reproducible) desde
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

## Cómo reproducir el dataset de desarrollo

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
 ruff check . && mypy app && pytest   # verificaciones (76 tests)

# Frontend (Node 24+) — con el backend levantado (proxy /api -> :8000 en dev)
cd frontend
npm install
npm run dev                          # UI en http://localhost:5173
npm run lint && npm test && npm run build   # oxlint + 197 tests + build
```

La documentación OpenAPI se genera en `/docs` y `/openapi.json` **en local**;
en producción (Render) está desactivada por seguridad.

En CI (GitHub Actions) los mismos mandatos corren en cada push y PR: `ruff` +
`mypy` + `pytest` para el backend, `oxlint` + `vitest` + `build` para el
frontend. Dependabot abre PRs semanales de actualización para pip, npm y
github-actions.

## Estructura

```
backend/   FastAPI + Pydantic (app/), tests/ (pytest)
  app/api/       rutas y esquemas (workbooks, copiloto, health)
  app/ai/        cadena de proveedores del copiloto, rate limit y caché
  app/core/      configuración, storage (FS + manifest), rate limit por IP y
                 generador del demo
  app/domain/    excel_parser (multi-formato, subproceso con timeout)
   tests/         pytest (76 tests)
frontend/  React + TypeScript con Vite (src/, tests con Vitest, 197 tests)
  src/edit.ts         motor de edición de hojas (puro, con límites)
  src/session.ts      sesión local por visitante (sessionStorage, se borra al cerrar)
  src/copilotRender.ts  markdown del copiloto con escape de HTML (anti-XSS)
boceto dashboard/  Boceto de UI de referencia (screen.png + DESIGN.md + code.html)
docs/adr/  Decisiones de arquitectura (0001 stack · 0002 persistencia FS ·
           0003 sesión local · 0004 TTL · 0005 formatos · 0006 rate limit ·
           0007 acceso abierto sin auth · 0008 sector del demo)
data/      empleados_demo.csv (base) · easyexcel_demo.xlsx (generado)
scripts/   generar_dataset_demo.py · verificar_dataset.py
.github/   CI: ruff + mypy + pytest · oxlint + vitest + build
```

Documentación transversal: [ARCHITECTURE.md](ARCHITECTURE.md) (diagrama y límites),
[CHANGELOG.md](CHANGELOG.md) (historia), [CONTRIBUTING.md](CONTRIBUTING.md)
(cómo contribuir) y [LICENSE](LICENSE) (MIT).

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
4. **Fase 4** — Vistas, filtros, búsqueda y gráficos ✅
   - Dashboard con 4 vistas navegables desde el sidebar: **Resumen** (6 KPIs del
     día + alertas, sin tabla), **Personal**, **Operaciones** (KPIs, gráficos,
     cobertura y hojas de su dominio) y **Datos** (el Excel completo); la
     sección activa queda guardada en la sesión local
   - Filtro por columna desde la cabecera de cada columna (valores con conteo
     o rango numérico), con chip quitable en la barra de herramientas;
     búsqueda global en todas las hojas con salto a la fila encontrada
     (resaltada 5 s) y cambio automático a la vista Datos; gráficos por
     dominio (barras y donut con selector de serie, recharts); hoja, filtros,
     búsqueda y página quedan guardados en la vista de la sesión local y se
     restauran al recargar
   - Corregido el scroll del dashboard: el marco ya no recorta el contenido
     (la rueda del ratón desplaza y la barra deslizante es siempre visible)
5. **Fase 5** — Exportación PDF/Excel y pulido de UI ✅
   - Export **.xlsx** de la hoja activa con lo que se ve aplicado (filtros,
     búsqueda, solo activos y columnas visibles), generado por el backend con
     openpyxl (`POST /workbooks/{id}/sheets/{hoja}/export`) y descargado con
     el nombre `{libro}_{hoja}.xlsx`; estado "Generando…" y límites
     server-side de filas, columnas y celdas
   - Export **PDF** con `window.print()` y CSS de impresión: arranca con una
     cabecera compacta (panel, hoja, fecha y filtros activos) y la tabla en la
     primera página; se ocultan banner, sidebar, toolbar, paginador, copiloto
     y (cuando hay tabla) los KPIs y paneles inferiores, sin páginas en
     blanco. En Resumen imprime su contenido: KPIs, alertas y gráficos
   - Menú "Exportar" (Excel/PDF) en topbar y toolbar; en Resumen (sin tabla)
     solo está habilitado el PDF
   - Pulido: el menú de filtro de columna se sirve en un portal al `body`
     (con una o dos filas ya no queda recortado) y el contador de búsqueda
     muestra el total filtrado sin el texto incorrecto "en la página"
6. **Fase 6** — Copiloto IA con modelos gratuitos ✅
   - `POST /api/v1/copiloto` con streaming SSE: cadena conmutable de
     proveedores (OpenRouter → NVIDIA) con configuración por env vars,
     rate limit por IP, caché de preguntas repetidas y logging de intentos
   - Contexto anclado a los datos del dashboard (KPIs, alertas, conteos por
     columna y muestra filtrada) con system prompt que prohíbe inventar
     números; el panel escribe en streaming, muestra proveedor y modelo, y
     avisa de que son modelos gratuitos para datos demo sin información
     personal real
7. **Fase 7** — Despliegue en producción ✅
   - Render (backend con disco persistente + frontend estático con proxy
     `/api`), dominio propio `easyexcel.kavanasystems.com`, CI en verde y
     auditoría de seguridad y documentación (22/10/2026)
8. **Fase 8** — Autenticación y multiusuario (pendiente; JWT + RLS cuando
   haya base de datos, ADR-0001). Hasta entonces la demo queda abierta sin
   auth por decisión registrada en el
   [ADR-0007](docs/adr/0007-acceso-abierto-sin-autenticacion.md), con las
   mitigaciones por IP ya en producción.

## Nota de privacidad

Todos los datos de este repositorio son **100 % sintéticos** (nombres, DNIs, teléfonos,
direcciones y empresas ficticios). No contienen datos reales de ninguna persona ni de
ninguna compañía. Los dominios usados (`ceramicaturia.es`, `empresa-limpieza.es`,
`demo.easyexcel.local`) son inventados. La demo no exige registro y no almacena nada del visitante más allá de
su sesión local en el navegador.

## Licencia

[MIT](LICENSE) — © 2026 Jorge Adán (Kavana Systems).
