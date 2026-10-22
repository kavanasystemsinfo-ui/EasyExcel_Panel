# ADR-0006: Rate limit del copiloto — 20 consultas/día por IP real

- **Estado**: Aceptado
- **Fecha**: 22/10/2026 (sustituye al límite inicial de 40 consultas / 10 min
  de la Fase 6, `c664734`)
- **Decisor**: Jorge (con recomendación técnica de Elias)

## Contexto

El copiloto consume modelos gratuitos de terceros (OpenRouter/NVIDIA) con
cuota por clave: una ráfaga de consultas de una sola IP agota la cadena para
todo el mundo y devuelve 503 al resto. Además, tras el despliegue en Render
`request.client.host` es la IP del proxy, no la del visitante, así que todos
los usuarios compartían un único cubo de rate limit. Por otro lado el mapa de
ventanas por IP crecía sin límite en una instancia single-worker.

## Decisión

| Punto | Elección |
|---|---|
| Cuota | **20 consultas por IP por ventana de 24 h** (`EASYEXCEL_COPILOTO_RATE_LIMIT` / `_RATE_WINDOW_S`, por defecto 20 y 86400) |
| IP real | **última** entrada de `X-Forwarded-For`: la primera la controla el cliente (spoofable) y la última la añade el propio proxy de Render |
| Memoria | `_MAX_IPS = 10.000`; al comprobar el límite se purgan las ventanas ya caducadas, con lo que el mapa queda acotado |
| Exceso | `429` con la cabecera de reintento; sin ninguna clave configurada el endpoint responde `503` antes de contar |
| Caché | las 200 primeras preguntas idénticas se responden de caché sin consumir cuota de modelo |

La IP derivada del header es una decisión deliberada: detrás del proxy de
Render el header es la única señal fiable, y se asume que el proxy pisa
cualquier `X-Forwarded-For` entrante (configuración de Render, fuera de este
repo). Si el servicio se expusiera sin proxy delante, habría que volver a
`request.client.host`.

## Alternativas consideradas

- **Primera IP del `X-Forwarded-For`**: descartada — la escribe el cliente y
  cambiando el header se evadía la cuota.
- **Cuota global por clave en lugar de por IP**: descartada — un solo usuario
  ruidoso dejaría sin servicio a los demás.
- **Cuota por sesión/usuario**: pendiente de la Fase 8 (auth); hoy no existe
  identidad de usuario, así que la IP es el único identificador disponible.

## Consecuencias

- **+** La cuota de los modelos gratuitos no se quema con una ráfaga.
- **+** Cada visitante tiene su propio cubo de 20/día y la memoria está acotada.
- **+** Cubierto por tests (RED→GREEN): última IP de `X-Forwarded-For` y purga
  de ventanas caducadas en `tests/test_copiloto.py`.
- **−** Detrás de un proxy, una IP corporativa NAT comparte cuota.
- **−** Con auth (Fase 8) convendrá migrar la cuota a usuario y dejar la IP
  como red de seguridad.

## Ampliación: subidas de Excel (22/10/2026)

El mismo mecanismo (`core/ratelimit.py`, IP real de la última posición de
`X-Forwarded-For`, ventana deslizante con purga de memoria) se aplicó a
`POST /api/v1/workbooks`: **30 subidas por hora por IP**
(`EASYEXCEL_UPLOAD_RATE_LIMIT` / `_RATE_WINDOW_S`). La comprobación ocurre
**antes de leer el body**, así que un atacante no puede materializar 10 MB
para recibir el 429, y las lecturas (listado, detalle, demo, export) no
consumen cuota. Cubierto por 3 tests en `test_workbooks.py`.
