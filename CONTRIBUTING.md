# Contribuir en EasyExcel Panel

Guía corta para trabajar en el repo con el mismo criterio con el que se ha
construido: cambios verificables, nada sin prueba que lo respalde.

## Requisitos

- Backend: Python 3.11+ (`pip install -e ".[dev]"` en `backend/`).
- Frontend: Node 24+ (`npm ci` en `frontend/`).
- Copiloto IA opcional en local: claves en `backend/.env` (ver
  `backend/.env.example`; nunca se suben al repo).

## Antes de tocar código

1. Escribe primero el test que falla (RED), luego hazlo pasar (GREEN) y solo
   después refactoriza. Un refactor sin test que lo respalde no entra.
2. Si la decisión cambia la arquitectura (storage, formatos, límites,
   despliegue…), deja un ADR en `docs/adr/` antes de implementar.
3. YAGNI: si no está en el plan, no se implementa.

## Comandos de verificación (los mismos que CI)

```bash
# backend
cd backend
ruff check . && mypy app && pytest -q        # 76 tests

# frontend
cd frontend
npm ci
npm run lint && npx vitest run && npm run build   # oxlint + 197 tests + build
```

El push a `main` ejecuta `.github/workflows/ci.yml` (ambos jobs en verde es
el requisito) y despliega automáticamente a Render.

## Commits

Formato convencional, mensaje en español:

```
feat(backend): descripcion corta
fix(frontend): descripcion corta
docs: ...
chore: ...
```

Un commit por fase o por cambio coherente; el historial se lee como diario de
decisiones, no como vertedero.

## Reglas del repo

- **Cero secretos**: `.env` está gitignorado; solo se versionan `.env.example`
  y env vars de Render.
- **Cifras del README desde la suite real**: si cambias el número de tests o
  un comportamiento documentado, actualiza README/CHANGELOG en el mismo PR.
- **Datos sintéticos**: nunca subir datos personales reales; la demo es
  pública y no tiene autenticación todavía (ver Fase 8 y ARCHITECTURE.md).
- **Dependabot** abre PRs semanales para pip, npm y github-actions: revisarlos
  antes de que acumulen.
