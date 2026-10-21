import { describe, expect, it } from 'vitest'
import type { Grafico } from './charts'
import type { Alerta } from './views'
import {
  alertasGenericas,
  esLibroDemo,
  inferirGraficos,
  inferirKpis,
  seccionesDeLibro,
  sugerenciasCopiloto,
} from './insights'
import type { SheetData } from './kpis'

const ventas: SheetData = {
  header: ['ID', 'Cliente', 'Importe', 'Fecha', 'Estado'],
  rows: [
    [1, 'Acme', 120.5, '2026-01-15', 'Pagado'],
    [2, 'Beta', 80, '2026-02-20', 'Pendiente'],
    [3, 'Acme', 200, '2026-03-10', 'Pagado'],
    [4, 'Gamma', 55.25, '2026-03-25', 'Anulado'],
    [5, 'Beta', 90, '2026-04-02', 'Pagado'],
  ],
}

const inventario: SheetData = {
  header: ['SKU', 'Producto', 'Stock', 'Categoria'],
  rows: [
    ['A1', 'Tornillo', 500, 'Fijacion'],
    ['A2', 'Clavo', 1200, 'Fijacion'],
    ['B1', 'Grasa', 30, 'Lubricante'],
    ['B2', 'Aceite', 45, 'Lubricante'],
  ],
}

const libroGenerico = { Ventas: ventas, Inventario: inventario }

describe('esLibroDemo', () => {
  it('reconoce el libro demo por sus hojas caracteristicas', () => {
    expect(esLibroDemo(['Empleados', 'Centros', 'Vacaciones'])).toBe(true)
  })

  it('reconoce el demo aunque falten algunas hojas', () => {
    expect(esLibroDemo(['Empleados', 'Otra'])).toBe(true)
  })

  it('un libro generico no es el demo', () => {
    expect(esLibroDemo(['Ventas', 'Inventario'])).toBe(false)
  })

  it('lista vacia no es el demo', () => {
    expect(esLibroDemo([])).toBe(false)
  })
})

describe('seccionesDeLibro', () => {
  it('para el demo devuelve las 4 secciones del dominio', () => {
    const ids = seccionesDeLibro(['Empleados', 'Centros']).map((s) => s.id)
    expect(ids).toEqual(['resumen', 'personal', 'operaciones', 'datos'])
  })

  it('para un libro generico solo resumen y datos', () => {
    const ids = seccionesDeLibro(['Ventas', 'Inventario']).map((s) => s.id)
    expect(ids).toEqual(['resumen', 'datos'])
  })
})

describe('inferirKpis', () => {
  it('genera un KPI de filas por hoja', () => {
    const kpis = inferirKpis(libroGenerico)
    const filasVentas = kpis.find((k) => k.key === 'filas-Ventas')
    expect(filasVentas).toBeDefined()
    expect(filasVentas?.valor).toBe('5')
    expect(filasVentas?.titulo).toContain('Ventas')
  })

  it('genera un KPI de suma para columnas numericas', () => {
    const kpis = inferirKpis(libroGenerico)
    const suma = kpis.find((k) => k.key === 'suma-Ventas-Importe')
    expect(suma).toBeDefined()
    expect(suma?.valor).toContain('545')
  })

  it('genera un KPI de media para columnas numericas', () => {
    const kpis = inferirKpis(libroGenerico)
    const media = kpis.find((k) => k.key === 'media-Ventas-Importe')
    expect(media).toBeDefined()
    expect(media?.valor).toContain('109')
  })

  it('genera un KPI de rango para columnas de fecha', () => {
    const kpis = inferirKpis(libroGenerico)
    const rango = kpis.find((k) => k.key === 'rango-Ventas-Fecha')
    expect(rango).toBeDefined()
    expect(rango?.valor).toContain('2026')
  })

  it('ignora columnas tipo id unica', () => {
    const kpis = inferirKpis(libroGenerico)
    expect(kpis.find((k) => k.key.includes('suma') && k.key.includes('ID'))).toBeUndefined()
    expect(kpis.find((k) => k.key.includes('suma') && k.key.includes('SKU'))).toBeUndefined()
  })

  it('ordena los KPIs de filas por numero de filas descendente', () => {
    const kpis = inferirKpis(libroGenerico)
    const claves = kpis.filter((k) => k.key.startsWith('filas-')).map((k) => k.key)
    expect(claves).toEqual(['filas-Ventas', 'filas-Inventario'])
  })

  it('limita el numero total de KPIs', () => {
    const grande: Record<string, SheetData> = {}
    for (let s = 0; s < 10; s++) {
      grande[`Hoja${s}`] = {
        header: ['A', 'B', 'C', 'D', 'E', 'F'],
        rows: Array.from({ length: 20 }, (_, i) => [i, i * 2, `v${i % 3}`, `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, i * 100, `t${i % 4}`]),
      }
    }
    expect(inferirKpis(grande).length).toBeLessThanOrEqual(8)
  })

  it('libro vacio devuelve lista vacia', () => {
    expect(inferirKpis({})).toEqual([])
  })
})

describe('inferirGraficos', () => {
  it('genera un grafico de barras para columnas categoricas', () => {
    const graficos = inferirGraficos(libroGenerico)
    const estado = graficos.find((g) => g.id === 'cat-Ventas-Estado')
    expect(estado).toBeDefined()
    expect(estado?.tipo).toBe('barras')
    expect(estado?.puntos.length).toBe(3)
  })

  it('genera un donut para columnas categoricas de baja cardinalidad', () => {
    const graficos = inferirGraficos(libroGenerico)
    const categoria = graficos.find((g) => g.id === 'cat-Inventario-Categoria')
    expect(categoria).toBeDefined()
    expect(categoria?.tipo).toBe('donut')
  })

  it('genera serie mensual para columnas de fecha', () => {
    const graficos = inferirGraficos(libroGenerico)
    const serie = graficos.find((g) => g.id === 'fecha-Ventas-Fecha')
    expect(serie).toBeDefined()
    expect(serie?.tipo).toBe('barras')
    expect(serie?.puntos.length).toBe(4)
  })

  it('omite columnas numericas continuas como grafico categorico', () => {
    const graficos = inferirGraficos(libroGenerico)
    expect(graficos.find((g) => g.id.includes('Importe') && g.id.startsWith('cat-'))).toBeUndefined()
  })

  it('limita el numero de graficos', () => {
    const grande: Record<string, SheetData> = {}
    for (let s = 0; s < 8; s++) {
      grande[`Hoja${s}`] = {
        header: ['Cat1', 'Cat2', 'Fecha'],
        rows: Array.from({ length: 15 }, (_, i) => [`a${i % 3}`, `b${i % 4}`, `2026-0${(i % 9) + 1}-15`]),
      }
    }
    expect(inferirGraficos(grande).length).toBeLessThanOrEqual(4)
  })

  it('libro vacio devuelve lista vacia', () => {
    expect(inferirGraficos({})).toEqual([])
  })

  it('devuelve el tipo Grafico valido', () => {
    const g: Grafico[] = inferirGraficos(libroGenerico)
    expect(g.every((x) => typeof x.id === 'string' && x.puntos.length > 0)).toBe(true)
  })
})

describe('alertasGenericas', () => {
  it('alerta de columnas con demasiados vacios', () => {
    const hoja: SheetData = {
      header: ['Nombre', 'Email'],
      rows: [
        ['Ana', 'ana@x.com'],
        ['Luis', ''],
        ['Marta', ''],
        ['Pedro', ''],
        ['Sara', ''],
      ],
    }
    const alertas = alertasGenericas({ Gente: hoja })
    expect(alertas.some((a) => a.texto.includes('Email'))).toBe(true)
  })

  it('sin problemas devuelve alerta ok', () => {
    const alertas = alertasGenericas(libroGenerico)
    expect(alertas).toHaveLength(1)
    expect(alertas[0].tono).toBe('ok')
  })

  it('detecta duplicados en columnas id', () => {
    const hoja: SheetData = {
      header: ['ID', 'Valor'],
      rows: [
        [1, 'a'],
        [1, 'b'],
        [2, 'c'],
        [2, 'd'],
      ],
    }
    const alertas = alertasGenericas({ X: hoja })
    expect(alertas.some((a) => a.texto.toLowerCase().includes('duplicad'))).toBe(true)
  })

  it('devuelve el tipo Alerta valido', () => {
    const a: Alerta[] = alertasGenericas(libroGenerico)
    expect(a.every((x) => ['danger', 'warn', 'info', 'ok'].includes(x.tono))).toBe(true)
  })
})

describe('sugerenciasCopiloto', () => {
  it('sugiere preguntas basadas en la hoja activa', () => {
    const s = sugerenciasCopiloto(ventas.header, 'Ventas')
    expect(s.length).toBeGreaterThan(0)
    expect(s.some((x) => x.includes('Ventas'))).toBe(true)
  })

  it('incluye pregunta sobre columna numerica', () => {
    const s = sugerenciasCopiloto(ventas.header, 'Ventas')
    expect(s.some((x) => x.toLowerCase().includes('importe'))).toBe(true)
  })

  it('con header vacio da sugerencias genericas', () => {
    const s = sugerenciasCopiloto([], 'Hoja1')
    expect(s.length).toBeGreaterThan(0)
    expect(s.every((x) => typeof x === 'string' && x.length > 0)).toBe(true)
  })

  it('da como maximo 6 sugerencias', () => {
    const headerLargo = Array.from({ length: 20 }, (_, i) => `Col${i}`)
    expect(sugerenciasCopiloto(headerLargo, 'X').length).toBeLessThanOrEqual(6)
  })
})
