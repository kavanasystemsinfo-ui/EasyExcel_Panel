# Changelog

Todo lo notable de EasyExcel Panel, con formato [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Unreleased]

### Added
- **Endurecimiento y pulido profesional (Fase C, 22/10/2026)**: `/docs` y `/openapi.json` desactivados en producción (detección automática por la variable `RENDER`, forzable con `EASYEXCEL_DOCS_ENABLED`; activos en local) con 4 tests nuevos; **rate limit de subidas: 30/hora por IP** con comprobación antes de leer el body (`core/ratelimit.py`, limiter compartido con el copiloto tras refactor, 3 tests) — 76 backend; `render.yaml` con `npm ci` (build reproducible) y cabeceras `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`; Dependabot semanal para pip, npm y github-actions (el ADR-0001 lo exigía y no existía) y su primera tanda de 8 PRs resuelta en un lote (`react-dom` 19.3.1, `jsdom` 30.1.3, `vitest` 5.0.5, `oxlint` 1.88.0, `@types/node` 26.6.5, actions a v7); `vite` actualizado dentro de su rango hasta 0 vulnerabilidades en `npm audit` y `pip-audit` sin CVEs; `CONTRIBUTING.md`; meta description y Open Graph en `index.html`; About del repo con descripción, topics y dominio vivo; origen Vercel muerto fuera de las CORS de Render; ADR-0007 fija la decisión
  de mantener la demo abierta sin autenticación apoyada en esas mitigaciones
  (auth pendiente para la Fase 8 con base de datos).

- **Documentación de producción (Fase B, 22/10/2026)**: README reescrito con la demo viva arriba del todo, cifras verificadas hoy (66 tests backend, 197 frontend, 9 endpoints, 20 consultas/día), los dos datasets explicados por separado (demo en vivo generada por el backend vs dataset de desarrollo de 215), sección de seguridad y límites, roadmap corregido (Fase 7 desplegada, Fase 8 pendiente) y badge de CI. Nuevo `LICENSE` (MIT, © 2026 Jorge Adán), `ARCHITECTURE.md` con diagrama Mermaid y mapa de módulos, `ADR-0005` (formatos de entrada .xls/.ods/.csv) y `ADR-0006` (rate limit 20/día con la IP real del proxy), enmiendas al `ADR-0001` (PostgreSQL y Vercel→Render) y `.env.example` actualizado (20/86400 y modelos por defecto reales).
- **Importación de `.xls`, `.ods` y `.csv` además de `.xlsx`** (commit `67bd143`): el parser detecta el formato por magic bytes (el storage guarda siempre `book.xlsx`) y despacha a openpyxl (`.xlsx`), xlrd (`.xls`), odfpy (`.ods`) o csv stdlib (`.csv`, con sniffing de delimitador `;`/`,`/tab, coma decimal convertida a punto y codificación utf-8-sig/cp1252/latin-1). La validación del upload comprueba extensión + magic por formato; los límites del ADR-0001 (10 MB, 50 hojas, 200 columnas, 100k filas) aplican a todos. El CSV nombraba su hoja por el stem del archivo. El padding de filas vacías repetidas que LibreOffice escribe en el ODS no se materializa (disparaba falsos límites). La exportación sigue siendo siempre `.xlsx`. Frontend: `accept` y copy ampliados a los 4 formatos. 14 tests nuevos (`test_import.py`).
- **Copiloto IA limitado a 20 consultas/día por IP** (commit `c664734`): rate limit por ventana deslizante de 24h (antes 40/10min). La IP real se toma de `X-Forwarded-For`, porque detrás del proxy de Render `request.client.host` es la IP del propio proxy y todos los usuarios compartían un solo cubo.
- **Borrado de los proyectos de EasyExcel en Vercel** (21/10/2026): `easyexcel-panel` y `easyexcel-panel-frontend` eliminados tras la migración a Render; el dominio `easyexcel.kavanasystems.com` no estaba ligado a Vercel.
- **Subidas efímeras con caducidad de 2 horas** (ADR-0004): los Excel de usuarios ya no viven permanente en el servidor. `storage.purge_expired` borra los workbooks con más de `EASYEXCEL_UPLOAD_TTL_HOURS` (por defecto 2) en cada operación de la API (subir, listar, leer, exportar, cargar el demo). El demo queda excluido y se regenera solo. Tests: purga por TTL, exención del demo, purga disparada por subida/export/listado/arranque del demo y TTL configurable.
- **Migración a Render con disco persistente** (21/10/2026): backend `easyexcel-backend.onrender.com` con disco 1GB montado en `/var/data`, variable `EASYEXCEL_UPLOAD_DIR=/var/data/uploads`. Frontend `easyexcel-frontend.onrender.com` estático con proxy `/api/*` → backend. Dominio propio `easyexcel.kavanasystems.com` verificado y sirviendo desde Render con certificado SSL. Los Excel subidos ya no se pierden al reiniciar la instancia.
- **Visualización genérica para cualquier Excel** (commit `ce3f218`): el panel ya no está atado al dominio de Personal/Operaciones. Sube cualquier `.xlsx` y genera automáticamente KPIs, gráficos, alertas y sugerencias del copiloto a partir de la estructura real de las hojas (columnas id, numéricas, categóricas y de fecha detectadas por nombre y contenido). El demo conserva su pipeline específico con 4 secciones; los libros genéricos muestran Resumen + Datos.
- Módulo `frontend/src/insights.ts` con inferencia de insights (29 tests unitarios).
- Props opcionales en `KpiCards`, `Alertas`, `CopilotPanel`, `Topbar` y `Sidebar` para soportar ambos modos sin romper el demo.
- 3 tests de integración de `App` con libro genérico (subida, KPIs en Resumen, sidebar reducido).

### Fixed
- **XSS en el panel del copiloto**: el escape de `renderRespuesta` era inópera (reemplazaba `<` por `<`, `&` por `&`), así que cualquier HTML que el modelo reprodujera — p. ej. de una celda maliciosa de un Excel compartido — llegaba vivo al `dangerouslySetInnerHTML` del panel. El render se ha movido a `frontend/src/copilotRender.ts`, escapa `&`, `<` y `>` antes de aplicar markdown, y hay tests de DOM que verifican que ningún `<img onerror=...>` se inyecta (197 tests frontend).
- **Rate limit del copiloto a prueba de spoofing**: la IP ahora sale de la **última** posición de `X-Forwarded-For` (la que añade el proxy de Render); antes se usaba la primera, que la controla el cliente, con lo que el límite de 20 consultas/día se evadía cambiando el header. Añadida cota de memoria `_MAX_IPS = 10.000` con purga de ventanas caducadas (antes el mapa crecía sin límite). 2 tests nuevos (RED→GREEN).
- **Upload con lectura acotada**: el body se lee por bloques de 1 MB y se corta en el primer MB que desborda el límite de 10 MB; antes `file.read()` materializaba el body completo en memoria antes del 413.
- **CI verde en `main`** (59 runs rojos seguidos desde el 08/10): ruff de 38 errores a 0 (orden de imports, líneas del generador demo reenvueltas sin cambiar el dataset, `raise ... from`, variable sin uso), mypy arreglado de raíz (`explicit_package_bases` + borrado de `backend/__init__.py`, guard de `sys.platform` para `SIGALRM`, `list[Any]` en las filas del demo), y `xlrd`/`odfpy` añadidos a `pyproject.toml`: el CI instala `.[dev]` y el parser importa esos paquetes a nivel de módulo, así que el job backend no podía pasar de los checks.
- **Test de timeout que no podía fallar**: `assert resp.status_code in (201, 422)` siempre se cumplía; sustituido por tests directos de `_run_with_timeout` (dispara `WorkbookParseTimeoutError` en Unix, ejecuta sin timeout en Windows).
- **Referencias muertas a Vercel**: rama `IS_VERCEL` fuera de `config.py`, comentario de Vercel fuera del docstring del upload y del docstring del parser.

### Removed
- `GET /api/v1/demo-data`: endpoint sin uso (lo consumía `default_demo.xlsx`, que solo existía para él) cuyo 404 devolvía un `os.listdir` del filesystem del servidor.
- Basura de raíz y restos de Vercel: `get-pip.py` (2,2 MB), `trigger.txt`, `update_readme.py`, `vercel.json`, `frontend/build.sh`, copias sin uso de `easyexcel_demo.xlsx` (raíz y `backend/data/`), `backend/data/default_demo.xlsx`, `mangum` de `requirements.txt`.
- `backend/__init__.py` (rompía mypy con "source file found twice"; `app` ya es paquete).

### Changed
- **Demo público reorientado al sector cerámico (ADR-0008, 22/10/2026)**: el
  generador `demo.py` pasa de metalúrgica a planta cerámica (`Cerámica Turia
  S.A.`, dominio sintético `ceramicaturia.es`): centros de producción y
  laboratorio, maquinaria de prensa/horno/esmaltado con marcas inventadas y
  proveedores de arcilla y esmaltes; se retiran los vestigios de limpieza que
  quedaban en maquinaria y auditorías. `DEMO_ID` versionado a `v7` para que
  Render siembre el nuevo libro; la historia de origen del README se reescribe
  de forma honesta (caso real en sector servicios, marco industrial actual) y
  el dataset de 215 empleados queda como histórico. 3 tests de sector
  (RED→GREEN) — 76 backend.
- **Subida de archivos en Vercel serverless** (commit `20ef469`): el endpoint `POST /api/v1/workbooks` ahora devuelve las filas parseadas (header + data de todas las hojas) en la misma respuesta del upload. Antes, el frontend hacía GETs posteriores por hoja que en serverless caían en otra instancia sin acceso al `/tmp` efímero de la subida y devolvían 404, dejando el grid vacío.
- Test rojo `test_demo_filas_reales`: ajustado a las 50 filas reales del generador demo (esperaba 215).
- `requirements.txt` del backend: + `xlrd>=2.0` (lectura de `.xls`) y `odfpy>=1.4` (lectura de `.ods`).
- `uploadWorkbook` en el frontend tipado como `WorkbookFullResponse` (incluye `header` y `data` por hoja).
- `handleFile` construye `WorkbookFull` directamente de la respuesta del upload, sin llamadas de seguimiento a `/sheets/{name}/rows`.
- `Alerta.id` ampliado de unión cerrada a `string` para soportar alertas genéricas.
- `graficosDeSeccion` muestra hasta 4 gráficos como máximo por sección en lugar de ilimitados.

## [0.1.0] - 2026-10-20

### Added
- Versión inicial: upload de `.xlsx`, demo público con 10 hojas de Personal/Operaciones, grid editable con filtros y paginación, KPIs y gráficos específicos del dominio, exportación Excel/PDF, copiloto IA con modelos gratuitos, sesión local con restablecer.
- Migración a Render con disco persistente preparada (`render.yaml`, `EASYEXCEL_UPLOAD_DIR`).
- Almacenamiento base64 sidecar para recuperación en cold starts de serverless.
