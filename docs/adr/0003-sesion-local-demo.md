# ADR-0003: Sesión local por visitante para la edición del demo

- **Estado**: Aceptado (2026-10-05, Fase 3)
- **Contexto**: Fase 3 (demo automática y edición libre)

## Contexto

La Fase 3 abre el panel a visitantes anónimos: al entrar se carga un libro demo
y el usuario puede crear campos, añadir filas, editar y eliminar. Esos cambios
deben sobrevivir a un refresh sin tocar el servidor, porque no hay usuarios ni
multiusuario todavía. El problema de diseño es qué mecanismo de identificación
usar para esa sesión.

## Decisión

- Los cambios de edición viven solo en el navegador:
  `localStorage['easyexcel:sesion:v1']` guarda `{ token, cambios, wb, guardadoEn }`
  con el libro completo ya cargado (`WorkbookFull`), de modo que un refresh
  repinta todo sin llamadas de red.
- El identificador de sesión es `token = crypto.randomUUID()` generado en el
  cliente (`nuevoToken()`), visible en la UI como "Sesión local a01f97af".
  **No se emite JWT ni existe endpoint de sesión**: sería teatro de seguridad si
  los datos no salen del PC del visitante.
- "Restablecer" borra la sesión local y vuelve a pedir el libro demo al servidor
  (que lo siembra idempotentemente desde `data/easyexcel_demo.xlsx`), por lo que
  siempre se puede volver al original.
- El libro demo es de solo lectura en el servidor (`DELETE` rechazado con 400):
  la edición solo existe en cada navegador.
- Límites del motor de edición en cliente: 200 columnas, 100.000 filas por hoja,
  y `guardarSesion()` devuelve `false` si el almacenamiento está lleno (la UI
  muestra el aviso en vez de perder el cambio en silencio).

## Consecuencias

- Cada visitante edita su propia copia: no hay sincronización entre navegadores
  ni entre equipos. Es el comportamiento esperado en una demo local.
- Si un usuario supera la cuota de `localStorage` (~5 MB), los cambios se aplican
  en memoria pero no persisten tras el refresh; se avisa y se ofrece restablecer.
- Subir un `.xlsx` propio descarta la sesión del demo: el upload sustituye el
  libro activo y genera un token nuevo.
- Cuando llegue la Fase 6 (usuarios y sync multiusuario), este mismo contrato se
  implementará con JWT real y persistencia en el servidor; el frontend solo
  cambiará la fuente de `cargarSesion`/`guardarSesion`.
