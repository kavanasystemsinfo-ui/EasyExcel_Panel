# ADR-0002: Persistencia de workbooks en filesystem con manifest JSON

- **Estado**: Aceptado (2026-10-05, Fase 2)
- **Contexto**: Fase 2 (carga y visualización de Excel)

## Contexto

La Fase 2 introduce carga de archivos `.xlsx` por la API. Hace falta persistir el
binario subido y sus metadatos (hojas, filas, columnas) en un entorno todavía sin
usuarios ni historial. El ADR-0001 fija PostgreSQL con migraciones versionadas para
los datos de negocio, pero no define dónde vive el archivo Excel.

## Decisión

- Un directorio por workbook bajo `backend/data/uploads/<uuid_v4>/` con dos ficheros:
  `book.xlsx` (binario) y `manifest.json` (`id`, `filename`, `uploaded_at` y las
  hojas con `rows`/`cols`).
- El manifest se genera en el `POST` de carga y es la fuente de verdad para el
  listado y el detalle: leer la lista de hojas no requiere reparsear el Excel.
- Todos los límites viven en `Settings` (configurables por entorno):
  10 MB por archivo, 50 hojas, 200 columnas, 100.000 filas por hoja,
  timeout de parsing de 5 s en subproceso.
- Los IDs se validan con `^[0-9a-f]{32}$` antes de componer rutas, descartando
  cualquier intento de path traversal.

## Consecuencias

- Sin base de datos en esta fase: un reinicio no pierde datos (disco local), pero
  el inventario vive en el FS, que en despliegues efímeros (Render) se vacía al
  redeploy. Aceptable mientras no hay usuarios; se vuelve a subir el archivo.
- Si más adelante aparecen usuarios, historial o editado compartido (Fase 6), los
  manifests pasan a tablas PostgreSQL; la API no cambia porque ya está desacoplada
  del transporte de persistencia.
- El binario queda detrás de una interfaz de almacenamiento simple en
  `WorkbookStorage`; migrarlo a S3/R2 es una sustitución de implementación.
