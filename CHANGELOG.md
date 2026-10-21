# Changelog

Todo lo notable de EasyExcel Panel, con formato [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Unreleased]

### Added
- **Migración a Render con disco persistente** (21/10/2026): backend `easyexcel-backend.onrender.com` con disco 1GB montado en `/var/data`, variable `EASYEXCEL_UPLOAD_DIR=/var/data/uploads`. Frontend `easyexcel-frontend.onrender.com` estático con proxy `/api/*` → backend. Dominio propio `easyexcel.kavanasystems.com` verificado y sirviendo desde Render con certificado SSL. Los Excel subidos ya no se pierden al reiniciar la instancia.
- **Visualización genérica para cualquier Excel** (commit `ce3f218`): el panel ya no está atado al dominio de Personal/Operaciones. Sube cualquier `.xlsx` y genera automáticamente KPIs, gráficos, alertas y sugerencias del copiloto a partir de la estructura real de las hojas (columnas id, numéricas, categóricas y de fecha detectadas por nombre y contenido). El demo conserva su pipeline específico con 4 secciones; los libros genéricos muestran Resumen + Datos.
- Módulo `frontend/src/insights.ts` con inferencia de insights (29 tests unitarios).
- Props opcionales en `KpiCards`, `Alertas`, `CopilotPanel`, `Topbar` y `Sidebar` para soportar ambos modos sin romper el demo.
- 3 tests de integración de `App` con libro genérico (subida, KPIs en Resumen, sidebar reducido).

### Fixed
- **Subida de archivos en Vercel serverless** (commit `20ef469`): el endpoint `POST /api/v1/workbooks` ahora devuelve las filas parseadas (header + data de todas las hojas) en la misma respuesta del upload. Antes, el frontend hacía GETs posteriores por hoja que en serverless caían en otra instancia sin acceso al `/tmp` efímero de la subida y devolvían 404, dejando el grid vacío.
- Test rojo `test_demo_filas_reales`: ajustado a las 50 filas reales del generador demo (esperaba 215).

### Changed
- `uploadWorkbook` en el frontend tipado como `WorkbookFullResponse` (incluye `header` y `data` por hoja).
- `handleFile` construye `WorkbookFull` directamente de la respuesta del upload, sin llamadas de seguimiento a `/sheets/{name}/rows`.
- `Alerta.id` ampliado de unión cerrada a `string` para soportar alertas genéricas.
- `graficosDeSeccion` muestra hasta 4 gráficos como máximo por sección en lugar de ilimitados.

## [0.1.0] - 2026-10-20

### Added
- Versión inicial: upload de `.xlsx`, demo público con 10 hojas de Personal/Operaciones, grid editable con filtros y paginación, KPIs y gráficos específicos del dominio, exportación Excel/PDF, copiloto IA con modelos gratuitos, sesión local con restablecer.
- Migración a Render con disco persistente preparada (`render.yaml`, `EASYEXCEL_UPLOAD_DIR`).
- Almacenamiento base64 sidecar para recuperación en cold starts de serverless.
