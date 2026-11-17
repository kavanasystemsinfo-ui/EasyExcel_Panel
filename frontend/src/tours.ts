import type { Seccion } from './views'
import type { TourStep } from './Tour'

type Acciones = {
  /** Abre una vista del panel (Resumen, Personal, Operaciones, Datos). */
  irASeccion: (seccion: Seccion) => void
}

/**
 * Recorridos del libro demo: uno por vista, encadenados. Las anclas son selectores
 * CSS de elementos que ya existen en el panel, así que no hace falta marcar nada.
 */
export function toursDemo({ irASeccion }: Acciones): Record<Seccion, TourStep[]> {
  return {
    resumen: [
      {
        id: 'bienvenida',
        title: 'Bienvenido a EasyExcel',
        content:
          'Es un panel de gestión que vive sobre un Excel. Los datos son de una planta cerámica inventada.\nEn menos de un minuto te enseño qué puedes hacer. Puedes salir cuando quieras con Esc.',
        action: () => irASeccion('resumen'),
      },
      {
        id: 'vistas',
        anchor: '.secciones',
        title: 'Cuatro vistas del mismo Excel',
        content:
          'Resumen, Personal, Operaciones y Datos. Cada una enseña una parte del mismo libro, sin que tengas que abrir ni cruzar hojas a mano.',
      },
      {
        id: 'kpis',
        anchor: '.kpi-grid',
        title: 'Los indicadores del día',
        content: 'Se calculan al momento con las hojas del Excel: plantilla activa, turnos, vacaciones, maquinaria y calidad de las auditorías.',
      },
      {
        id: 'alertas',
        anchor: '.alertas-card',
        title: 'Lo que pide atención hoy',
        content: 'Las alertas salen de los mismos datos. Por ejemplo, las bajas en plantilla o las revisiones de maquinaria vencidas.',
      },
      {
        id: 'copiloto',
        anchor: '.copilot',
        title: 'Un asistente que conoce tus datos',
        content:
          'Pregúntale a tus hojas en lenguaje normal. Trae preguntas sugeridas para empezar y puedes plegarlo pulsando su cabecera.',
      },
      {
        id: 'sesion',
        anchor: '.topbar-right',
        title: 'Prueba lo que quieras',
        content:
          'Todo lo que edites se guarda solo en tu navegador, no en el Excel original. «Restablecer» lo deja como estaba.\nDesde aquí también exportas a Excel o PDF y cargas tu propio archivo.',
        siguiente: 'personal',
      },
    ],
    personal: [
      {
        id: 'personal-kpis',
        anchor: '.kpi-grid',
        title: 'Personal',
        content: 'Plantilla activa, turnos y vacaciones en curso, a partir de las hojas Empleados, Contratos, Vacaciones y Asignaciones.',
        action: () => irASeccion('personal'),
      },
      {
        id: 'personal-herramientas',
        anchor: '.toolbar',
        title: 'Buscar, filtrar y elegir columnas',
        content:
          'Filtra por cualquier columna, oculta las que no te hagan falta y exporta la hoja tal como la ves.',
      },
      {
        id: 'personal-tabla',
        anchor: '.grid-card',
        title: 'La tabla se edita',
        content:
          'Pulsa una celda para cambiar su valor. Puedes añadir o borrar filas, y cada cabecera tiene su menú de filtro con el número de filas de cada valor.',
      },
      {
        id: 'personal-graficos',
        anchor: '.charts-card',
        title: 'Gráficos',
        content: 'Barras y donut que cambian con la serie que elijas.',
        siguiente: 'operaciones',
      },
    ],
    operaciones: [
      {
        id: 'operaciones-kpis',
        anchor: '.kpi-grid',
        title: 'Operaciones',
        content: 'Centros operativos, maquinaria y calidad de las auditorías, en cifras.',
        action: () => irASeccion('operaciones'),
      },
      {
        id: 'operaciones-cobertura',
        anchor: 'section[aria-label="Cobertura por centro"]',
        title: 'Cobertura por centro',
        content: 'Cuántas personas están activas frente a la plantilla asignada a cada centro.',
      },
      {
        id: 'operaciones-tabla',
        anchor: '.grid-card',
        title: 'Y debajo, los datos',
        content: 'Las hojas de la vista: centros, auditorías, maquinaria, revisiones y proveedores.',
        siguiente: 'datos',
      },
    ],
    datos: [
      {
        id: 'datos-hojas',
        anchor: '.grid-head',
        title: 'Todas las hojas del libro',
        content: 'Aquí están las 10 hojas del Excel, como pestañas. Cambia de una a otra cuando quieras.',
        action: () => irASeccion('datos'),
      },
      {
        id: 'datos-busqueda',
        anchor: '.topbar-search',
        title: 'Búsqueda en todo el libro',
        content:
          'Escribe una palabra y verás las coincidencias de todas las hojas. Pulsa una y salta a esa fila.',
      },
      {
        id: 'datos-exportar',
        anchor: '.topbar-right .export-wrap',
        title: 'Exportar',
        content: 'Descarga la hoja abierta en Excel, o en PDF para imprimirla. Respeta tus filtros y columnas visibles.',
      },
      {
        id: 'datos-fin',
        title: 'Ahora prueba con el tuyo',
        content:
          'Pulsa «Cargar archivo» y sube un .xlsx, .xls, .ods o .csv. Se analiza al momento y se borra solo a las 2 horas.\nPuedes repetir este tour cuando quieras con el botón «Tour guiado».',
      },
    ],
  }
}

/** Recorrido corto para cuando el visitante ha subido su propio archivo. */
export function tourGenerico({ irASeccion }: Acciones): Record<string, TourStep[]> {
  return {
    generico: [
      {
        id: 'generico-vistas',
        anchor: '.secciones',
        title: 'Tu archivo, en dos vistas',
        content: 'Resumen con cifras generales y Datos con todas las hojas.',
        action: () => irASeccion('datos'),
      },
      {
        id: 'generico-herramientas',
        anchor: '.toolbar',
        title: 'Buscar y filtrar',
        content: 'Filtra por cualquier columna, oculta las que no necesites y exporta lo que ves.',
      },
      {
        id: 'generico-tabla',
        anchor: '.grid-card',
        title: 'Edita en el navegador',
        content: 'Pulsa una celda para cambiarla. Nada se guarda fuera de tu navegador y se borra a las 2 horas.',
      },
    ],
  }
}
