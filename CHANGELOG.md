# Changelog

Todo lo notable de EasyExcel Panel, con formato [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Unreleased]

### Added
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
- **Subida de archivos en Vercel serverless** (commit `20ef469`): el endpoint `POST /api/v1/workbooks` ahora devuelve las filas parseadas (header + data de todas las hojas) en la misma respuesta del upload. Antes, el frontend hacía GETs posteriores por hoja que en serverless caían en otra instancia sin acceso al `/tmp` efímero de la subida y devolvían 404, dejando el grid vacío.
- Test rojo `test_demo_filas_reales`: ajustado a las 50 filas reales del generador demo (esperaba 215).

### Changed
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
