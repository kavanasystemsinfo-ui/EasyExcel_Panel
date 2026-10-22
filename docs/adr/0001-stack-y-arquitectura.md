# ADR-0001: Stack y arquitectura de EasyExcel Panel

- **Estado**: Aceptado, con enmiendas (ver abajo)
- **Fecha**: 05/10/2026
- **Decisor**: Jorge (con recomendación técnica de Elias)

## Contexto

EasyExcel Panel es un dashboard web sobre archivos Excel (.xlsx): carga, visualización
en grid, edición, filtros, gráficos, exportación, con visión futura de auth multiusuario
e IA (asistente sobre los datos). Requisitos duros:

1. **Seguridad**: procesa archivos de usuario (parser .xlsx = superficie de ataque),
   datos de personal (futuro: RGPD), acceso multiusuario por tenant.
2. **Escalabilidad**: API stateless, almacenamiento de archivos que permita crecer
   sin migrar de arquitectura, despliegue horizontal.
3. **Dominio del producto**: el núcleo es datos tabulares + roadmap con IA y conectores.
4. **Cliente final**: solo navegador (portátil corporativo capado; nada de instalación).

## Decisión

| Capa | Elección |
|---|---|
| Frontend | React + TypeScript estricto + Vite; TanStack Table (grid), Recharts (charts) |
| Backend | FastAPI + Pydantic v2 + Uvicorn; OpenAPI generado automáticamente |
| Parsing .xlsx | openpyxl tras una **interfaz `ExcelParser`** aislada (subproceso con límites de recursos) |
| Base de datos | PostgreSQL (relacional = dominio; RLS por tenant en Fase 6) |
| Almacenamiento | Interfaz `Storage`: FS local en dev, S3-compatible (R2/S3) en prod |
| Auth (Fase 6) | JWT access+refresh con rotación, hash Argon2id, rate limiting |
| API de contratos | OpenAPI → genera clientes TS para el frontend (los dos lenguajes se sincronizan solos) |
| Despliegue | Docker; Vercel (frontend) + Render (backend) + Neon (Postgres) |
| Calidad | ruff + mypy (backend), ESLint + tsc (frontend), pytest + Vitest, CI en GitHub Actions |

## Alternativas consideradas

### NestJS + Express + ExcelJS (Node end-to-end)
Sólida opción empresarial (módulos, guards RBAC, TypeScript e2e). Descartada porque:
el núcleo del producto (parsing de Excel, validación tabular, roadmap IA/RAG) vive en el
ecosistema Python; en Node esa lógica acabaría duplicada o con integraciones de menor
madurez. No se descarta por calidad, sino por adecuación al dominio.

### Next.js fullstack
SSR innecesario (dashboard privado tras auth, no sitio público de contenido); acopla
frontend y backend dificultando el despliegue separado en Vercel+Render.

### Django (DRF)
Peso de monolito innecesario para API + SPA; su ventaja (admin) no aplica: la UI es el
dashboard propio.

### SQLite / filesystem como almacén final
No superan el requisito multiusuario/escalabilidad; se usan solo como modo local detrás
de las interfaces.

## Consecuencias

- **+** Validación en un solo sitio (Pydantic) para entrada de datos y contratos API.
- **+** OpenAPI automático satisface la Fase 1 (documentación) sin trabajo extra.
- **+** Los scripts de validación del dataset (`scripts/`) se reutilizan como capa de
  dominio del backend.
- **+** Ecosistema IA disponible sin cambiar de lenguaje en el futuro.
- **−** Dos lenguajes (mitigado: el cliente TS del frontend se genera desde OpenAPI).
- **−** openpyxl aísla el riesgo de parser pero exige límites estrictos (tamaño máximo
  de upload, timeout, sin entidades externas XML, zonas sin fórmulas activadas).

## Criterios de seguridad (exigibles en review)

1. Upload con límite de tamaño y de hojas/columnas; validación ZIP antes de parsear.
2. Parsing aislado con timeout; nunca confiar en celdas como HTML/SQL.
3. Parámetros por binding tipado (Pydantic), cero SQL concatenado (ORM o parametrizado).
4. CORS restrictivo, CSP en frontend, cookies HttpOnly/SameSite si se usan.
5. Secretos solo en variables de entorno; Dependabot activo.
6. En Fase 6: RLS de PostgreSQL + autorización por recurso en cada endpoint.

## Criterios de escalabilidad

1. API stateless (sin sesiones en memoria) → réplicas horizontales.
2. Archivos en object storage tras interfaz (migración sin tocar código de negocio).
3. Exportaciones PDF y trabajos pesados en cola/worker, fuera del request cycle.
4. DB con pool de conexiones y migraciones versionadas desde la Fase 1.

## Enmiendas (22/10/2026)

El texto de arriba se conserva como decisión histórica; tres puntos han sido
superados por la realidad del proyecto:

1. **Base de datos**: PostgreSQL/Neon no se ha llegado a usar. La persistencia
   real de los workbooks es filesystem + manifest JSON tras la interfaz
   `Storage` — ver [ADR-0002](0002-persistencia-workbooks-fs.md). El parser
   multi-formato añadió xlrd/odfpy/csv además de openpyxl: [ADR-0005](0005-formatos-entrada-xls-ods-csv.md).
2. **Despliegue**: Vercel se retiró (el filesystem efímero de `/tmp` perdía los
   Excel subidos); todo vive en Render con disco persistente, configurado en
   `render.yaml`. El despliegue y las env vars de la API de Render están
   documentados en [ARCHITECTURE.md](../../ARCHITECTURE.md).
3. **Rate limit del copiloto**: la Fase 6 definió 40/10 min; hoy es 20
   consultas/día por IP real con poda de memoria — ver
   [ADR-0006](0006-copiloto-rate-limit-20-dia.md).

La seguridad de uploads, parseo aislado y límites de estructura de este ADR
siguen vigentes y están automatizados en tests.
