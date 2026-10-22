# ADR-0007: Acceso abierto sin autenticación en la demo de producción

- **Estado**: Aceptado
- **Fecha**: 22/10/2026 (tras el endurecimiento de Fase C)
- **Decisor**: Jorge (con recomendación técnica de Elias)

## Contexto

La demo vive en producción (`easyexcel.kavanasystems.com`) con escritura
anónima: cualquier visitante puede subir un `.xlsx` y consultar el libro
demo. No hay base de datos ni usuarios, así que cualquier sistema de
autenticación sería, hoy, identidad sin nada que proteger por usuario. Se
plantearon tres opciones para dejar "el repo completamente profesional y
verificable en todos los aspectos":

1. Sin auth, con las mitigaciones perimetrales ya desplegadas.
2. Auth opcional con API key para la escritura.
3. JWT completo con base de datos (la Fase 8 del roadmap, `ADR-0001`).

## Decisión

**La demo permanece abierta sin autenticación** (opción 1) y se apoyan
únicamente en las mitigaciones perimetrales ya en producción y verificadas
en vivo:

| Mitigación | Valor | Verificación |
|---|---|---|
| Cuota de subidas | 30/hora por IP real, 429 antes de leer el body | 429 real en producción (22/10/2026) |
| Tamaño de upload | 10 MB en bloques de 1 MB, 413 al primer bloque desbordado | tests + smoke |
| Cuota del copiloto | 20 consultas/día por IP real (`ADR-0006`) | tests + producción |
| CORS | lista cerrada de orígenes (dominio vivo + localhost), sin `*` | lectura de cabeceras en vivo |
| Swagger/OpenAPI | apagados en Render (404), activos en local | 404 en vivo |
| Datos | 100 % sintéticos; el libro demo es de solo lectura en servidor | `ADR-0003` |
| Expiración | subidas con TTL de 2 h (`ADR-0004`) | `ADR-0004` |

La autenticación queda explícitamente **fuera de alcance hasta la Fase 8**
(JWT + RLS cuando haya base de datos, `ADR-0001`).

## Alternativas consideradas

- **API key opcional para escritura**: descartada por ahora — añade un flujo
  de gestión de claves en una demo cuyo valor es abrirse y verificarse al
  instante sin registro, y la cuota por IP ya limita el abuso.
- **JWT completo**: descartado por ahora — exige base de datos, flujos de
  registro/recuperación y una superficie de fallos nueva, sin beneficio
  mientras todos los datos son sintéticos y la edición de visita vive en
  `sessionStorage` (`ADR-0003`).

## Consecuencias

- **+** La demo es verificable al instante por URL viva, sin registro: es el
  requisito del propio proyecto para demos dirigidas a reclutadores.
- **+** Cero superficie de autenticación que mantener, auditar o romper
  (YAGNI); todo el esfuerzo de seguridad queda en límites por IP, CORS y
  expiración.
- **−** Cualquiera puede subir ficheros hasta la cuota, y el listado de
  workbooks es público: lo que suba un visitante es visible para todos
  hasta el TTL de 2 h. Asumido mientras los datos sean demo.
- **−** Una IP corporativa NAT comparte la cuota de subidas y la del
  copiloto; si molesta en uso real, revisar antes que autenticar.
- **Revisar cuando** haya base de datos (Fase 8), aparezca abuso real en los
  logs de Render o el producto necesite datos privados por usuario; en ese
  momento migrar las cuotas de IP a usuario (señalado ya en `ADR-0006`).
