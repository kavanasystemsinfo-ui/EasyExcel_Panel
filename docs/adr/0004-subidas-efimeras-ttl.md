# ADR-0004: Subidas efímeras con caducidad de 2 horas

- **Estado**: Aceptado (2026-10-21)
- **Contexto**: privacidad y limpieza del disco tras la migración a Render

## Contexto

Con la migración a Render los Excel de usuarios pasan a vivir en un disco
persistente (1GB en `/var/data/uploads`), y hasta ahora se guardaban de forma
permanente: cualquier archivo que alguien subiera se quedaba en el servidor
para siempre, salvo borrado manual. Eso contradice el criterio de producto de
que los datos de terceros no deben acumularse en la infraestructura propia.

El análisis previo mostró que el archivo en disco apenas se necesita: tras la
subida el frontend recibe todas las filas en la misma respuesta (commit
`20ef469`) y la sesión vive en `sessionStorage`, así que `GET .../rows` solo se
usa para el demo. En el export el backend valida el `manifest` pero el
contenido sale entero del payload del navegador (`book_path` en `export_sheet`
era código muerto).

Quedaban dos opciones: no persistir nada (rompía ~10 tests y el contrato de la
API) o caducidad con TTL. Se eligió TTL a petición explícita del propietario.

## Decisión

- **Las subidas de usuarios caducan a las 2 horas** y se borran solos.
  Configurable con `EASYEXCEL_UPLOAD_TTL_HOURS` (float de horas, por defecto
  `2.0` en `Settings.upload_ttl_hours`).
- `WorkbookStorage.purge_expired(ttl_hours, exclude)` borra los directorios de
  workbooks cuyo `uploaded_at` supera el TTL. Los ids en `exclude` nunca se
  tocan: **el demo queda exento** y se regenera solo con `ensure_demo()`.
- La purga es perezosa y se dispara en cada operación de la API (`_purge()` en
  `workbooks.py`): subir, listar, leer detalle, exportar y cargar el demo. Al
  cargar la home siempre se pide el demo, así que toda visita limpia el disco.
- Un directorio sin `manifest` legible (subida interrumpida) caduca por su
  `mtime`, no se queda huérfano para siempre.
- `ttl_hours <= 0` desactiva la purga (escape hatch para pruebas).

## Consecuencias

- Un usuario que sube un Excel y vuelve a la pestaña pasadas 2 horas pierde el
  libro del servidor: la sesión local sigue pintando el grid y el export sigue
  funcionando (el payload lleva los datos), pero `GET /{id}` devolverá 404. Es
  el comportamiento pedido: nada permanente.
- El disco solo retiene el demo y las subidas de las últimas 2 horas; el uso se
  mantiene acotado sin cron ni tareas programadas en Render.
- La purga añade un barrido de directorios por request. Con pocos workbooks
  vivos (TTL corto) el coste es despreciable frente al parseo del Excel.
- Si en el futuro se necesita retener libros (usuarios reales, Fase 6), hay que
  replantear este ADR: la persistencia pasaría a ser por cuenta, no por TTL.
