# ADR-0008: Sector del demo público — planta cerámica

- **Estado**: Aceptado
- **Fecha**: 22/10/2026
- **Decisor**: Jorge (con recomendación técnica de Elias)

## Contexto

El demo público nació con temática de limpieza (el caso real de origen: gestión
de personal multi-centro observada en el sector servicios) y en un momento del
desarrollo se regeneró con temática metalúrgica sin actualizar la documentación.
Resultado: el README contaba una historia (limpieza), el Excel mostraba otra
(metalúrgica) y encima la maquinaria seguía siendo de limpieza (fregadoras,
carros), lo que rompía la credibilidad de la demo. Al mismo tiempo la identidad
de Jorge es el puente planta-oficina en el sector industrial/manufacturero, con
dos proyectos ya situados: KAVANA Steelworks (metalurgia, su especialidad) y
KAVANA Manufacturing (demo de fábrica de snacks).

## Decisión

**El demo público usa temática de planta cerámica** (`Cerámica Turia S.A.`,
dominio sintético `ceramicaturia.es`), regenerado por `_generate_ceramica_demo`
en `backend/app/core/demo.py` con la misma semilla fija (`20261020`):

- `DEMO_ID` se versiona a `easyexcel:demo:v7`, con lo que Render siembra el
  nuevo libro automáticamente en el próximo arranque y el v6 se puede borrar
  con `DELETE /workbooks/{id}` (ya no es el demo vigente).
- Centros: Planta Norte, Planta Sur, Esmaltado Central, Almacén de Terminado,
  Oficina Central, Laboratorio de Calidad. Maquinaria: prensas, hornos, línea
  de esmaltado, compresor, molino, carretilla (marcas inventadas). Proveedores:
  arcilla y caolín, esmaltes y engobes, refractarios, paletizado.
- Los nombres, dominios y personas son sintéticos y se declaran como tales en
  la nota de privacidad del README.
- La historia de origen real (sector servicios) se conserva de forma honesta en
  el README, explicando el cambio de marco al dataset industrial actual.

## Alternativas consideradas

- **Metalúrgica (la especialidad de Jorge)**: descartada por solaparse con la
  identidad de KAVANA Steelworks; dos demos metalúrgicas confundirían a un
  reclutador y EasyExcel perdería su papel de entrada transversal.
- **Fábrica de snacks**: descartada por solaparse con el demo de KAVANA
  Manufacturing.
- **Industrial genérico ("Industria Norte")**: descartado porque una demo
  creíble vive mejor con un sector concreto y defendible.
- **Automoción**: válida y honesta, pero el cerámico es más cercano
  geográficamente (entorno industrial de Paterna/Valencia) y más diferenciado.
- **Mantener limpieza**: descartada porque contradice la identidad industrial
  de cara al mundo.

## Consecuencias

- **+** El README, el Excel y la identidad profesional cuentan la misma
  historia, y el sector no compite con Steelworks ni con Manufacturing.
- **+** El dataset de 215 empleados de limpieza queda como histórico del
  proyecto, documentado como tal.
- **−** Las personas del entorno cerámico valenciano que busquen "mi sector"
  encuentran un demo que les es familiar de entrada; fuera de eso, el sector
  concreto importa menos que la coherencia.
- **Cubierto por tests**: `test_demo_sector_ceramico_info_y_centros`,
  `test_demo_maquinaria_industrial_sin_vestigios_de_limpieza` y
  `test_demo_empleados_y_proveedores_del_sector` en `tests/test_workbooks.py`
  (RED→GREEN).
