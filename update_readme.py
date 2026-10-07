#!/usr/bin/env python3
with open('README.md', 'r', encoding='utf-8') as f:
    content = f.read()

old = "| Asistente IA: preguntas en lenguaje natural con contexto anclado (KPIs, alertas, conteos por columna y muestra filtrada), streaming SSE, cadena de respaldo de modelos gratuitos (OpenRouter → NVIDIA), rate limit por IP y caché de preguntas repetidas | **VERIFICADO** (10 tests backend + 9 frontend + E2E real: \"¿Cuántos de vacaciones hoy?\" → \"15 empleados\" = `kpis.vacaciones.hoy`, vía `openrouter · cohere/north-mini-code:free`) |"

new = "| Asistente IA: preguntas en lenguaje natural con contexto anclado (KPIs, alertas, conteos por columna y muestra filtrada), streaming SSE, cadena de respaldo de modelos gratuitos (OpenRouter → gemma-4-31b-it:free / north-mini-code:free), rate limit por IP y caché de preguntas repetidas | **VERIFICADO** (10 tests backend + 9 frontend + E2E real: \"¿Cuántos de vacaciones hoy?\" → \"15 empleados\" = `kpis.vacaciones.hoy`, vía `openrouter · gemma-4-31b-it:free / north-mini-code:free`) |"

if old in content:
    content = content.replace(old, new)
    with open('README.md', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replacement successful")
else:
    print("Old string not found")
    # Show what's around line 39
    lines = content.split('\n')
    for i, line in enumerate(lines[36:43], start=37):
        print(f"{i}: {line}")
PYEOF