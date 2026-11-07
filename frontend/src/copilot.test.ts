import { describe, expect, it } from 'vitest'
import { construirContexto, MAX_CONTEOS_COLUMNAS, MAX_MUESTRA_FILAS } from './copilot'

const header = ['Nombre', 'Estado', 'Centro', 'Horas']
const filas: unknown[][] = [
  ['Ana Perez', 'Activo', 'CC01', 42],
  ['Luis Gil', 'Baja', 'CC02', 38],
  ['Rosa Vera', 'Vacaciones', 'CC01', 40],
]

function base() {
  return {
    hoja: 'Empleados',
    seccion: 'Personal',
    filtros: ['Estado = Baja'],
    kpis: { plantilla: { activos: 130 } },
    alertas: ['30 bajas este mes'],
    header,
    filas,
  }
}

describe('construirContexto', () => {
  it('incluye hoja, seccion, filtros, kpis y alertas', () => {
    const ctx = construirContexto(base())
    expect(ctx.hoja).toBe('Empleados')
    expect(ctx.seccion).toBe('Personal')
    expect(ctx.filtros).toEqual(['Estado = Baja'])
    expect(JSON.stringify(ctx.kpis)).toContain('130')
    expect(ctx.alertas).toEqual(['30 bajas este mes'])
  })

  it('recoge la muestra con las primeras filas filtradas', () => {
    const ctx = construirContexto(base())
    expect(ctx.muestra.header).toEqual(header)
    expect(ctx.muestra.filas).toHaveLength(3)
    expect(ctx.muestra.filas[0][0]).toBe('Ana Perez')
  })

  it('limita la muestra a 15 filas', () => {
    const muchas = Array.from({ length: 50 }, (_, i) => [`F${i}`, 'Activo', 'CC01', 40])
    const ctx = construirContexto({ ...base(), filas: muchas })
    expect(ctx.muestra.filas).toHaveLength(MAX_MUESTRA_FILAS)
  })

  it('trunca celdas largas a 60 caracteres', () => {
    const larga = 'x'.repeat(200)
    const ctx = construirContexto({
      ...base(),
      header: ['Nota'],
      filas: [[larga]],
    })
    expect(ctx.muestra.filas[0][0].length).toBeLessThanOrEqual(60)
  })

  it('cuenta los valores de columnas no numericas', () => {
    const ctx = construirContexto(base())
    expect(ctx.conteos.Estado).toEqual([
      { valor: 'Activo', conteo: 1 },
      { valor: 'Baja', conteo: 1 },
      { valor: 'Vacaciones', conteo: 1 },
    ])
    expect(ctx.conteos.Centro).toHaveLength(2)
  })

  it('omite las columnas numericas de los conteos', () => {
    const ctx = construirContexto(base())
    expect(ctx.conteos.Horas).toBeUndefined()
  })

  it('acota las columnas de conteo', () => {
    const columnas = Array.from({ length: 12 }, (_, i) => `Cat${i}`)
    const ctx = construirContexto({
      ...base(),
      header: columnas,
      filas: [columnas.map((c) => `${c}-v1`)],
    })
    expect(Object.keys(ctx.conteos).length).toBeLessThanOrEqual(MAX_CONTEOS_COLUMNAS)
  })

  it('sigue siendo utilizable como JSON compacto', () => {
    const ctx = construirContexto(base())
    const blob = JSON.stringify(ctx)
    expect(blob.length).toBeLessThan(60_000)
  })
})

describe('construirContexto: cifras sobre todas las filas', () => {
  const filas = Array.from({ length: 100 }, (_, i) => [
    i % 2 === 0 ? 'Norte' : 'Sur',
    i % 4 === 0 ? 'Ana' : i % 4 === 1 ? 'Luis' : 'Eva',
    '125.5',
    '28045',
    `2025-0${(i % 9) + 1}-10`,
  ])
  const ctx = construirContexto({
    hoja: 'Ventas',
    seccion: 'Datos',
    filtros: [],
    kpis: null,
    alertas: [],
    header: ['Zona', 'Comercial', 'Importe', 'Cód. postal', 'Fecha'],
    filas,
  })

  it('suma toda la hoja, no solo la muestra', () => {
    expect(ctx.total_filas).toBe(100)
    expect(ctx.muestra.filas).toHaveLength(MAX_MUESTRA_FILAS)
    expect(ctx.estadisticas['Importe']).toMatchObject({ n: 100, suma: 12550, media: 125.5 })
  })

  it('no calcula estadisticas de codigos postales', () => {
    expect(ctx.estadisticas['Cód. postal']).toBeUndefined()
  })

  it('agrupa por categoria con la suma real', () => {
    const cruce = ctx.cruces['Importe por Zona']
    expect(cruce).toHaveLength(2)
    expect(cruce[0].suma).toBe(6275)
  })

  it('da el rango de fechas', () => {
    expect(ctx.rangos_fechas['Fecha']).toEqual(['2025-01-10', '2025-09-10'])
  })
})
