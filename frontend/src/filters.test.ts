import { describe, expect, it } from 'vitest'
import {
  aplicarFiltros,
  esColumnaNumerica,
  pasaFiltros,
  valoresDistintos,
  type Filtro,
} from './filters'

const rows: unknown[][] = [
  ['Sara', 'Activo', 25],
  ['María', 'Activo', 40],
  ['Álvaro', 'Baja', 35],
  ['Sara', 'activo', 25],
  ['Nuria', '', 0],
]

describe('valoresDistintos', () => {
  it('agrupa ignorando mayusculas y tildes con sus conteos', () => {
    const vals = valoresDistintos(rows, 1)
    expect(vals).toEqual([
      { valor: 'Activo', conteo: 3 },
      { valor: 'Baja', conteo: 1 },
    ])
  })

  it('ordena alfabeticamente sin distinguir tildes', () => {
    const vals = valoresDistintos([['Álvaro'], ['Berta'], ['alberto']], 0)
    expect(vals.map((v) => v.valor)).toEqual(['alberto', 'Álvaro', 'Berta'])
  })

  it('ignora celdas vacias', () => {
    const vals = valoresDistintos(rows, 1)
    expect(vals.some((v) => v.valor === '')).toBe(false)
  })

  it('devuelve vacio sin filas', () => {
    expect(valoresDistintos([], 1)).toEqual([])
  })
})

describe('esColumnaNumerica', () => {
  it('detecta numeros y textos numericos con formato español', () => {
    expect(esColumnaNumerica([[25], ['40'], [0]], 0)).toBe(true)
    expect(esColumnaNumerica([['1.234,56'], ['40']], 0)).toBe(true)
  })

  it('rechaza columnas de texto', () => {
    expect(esColumnaNumerica([['Sara'], ['María']], 0)).toBe(false)
    expect(esColumnaNumerica([['25'], ['Sara']], 0)).toBe(false)
  })

  it('rechaza columnas vacias', () => {
    expect(esColumnaNumerica([[''], ['']], 0)).toBe(false)
  })
})

describe('aplicarFiltros', () => {
  it('filtra por valores seleccionados con igualdad insensible', () => {
    const filtros: Filtro[] = [{ col: 1, tipo: 'valores', valores: ['baja'] }]
    const salida = aplicarFiltros(rows, filtros)
    expect(salida).toEqual([['Álvaro', 'Baja', 35]])
  })

  it('aplica rango numerico inclusivo', () => {
    const filtros: Filtro[] = [{ col: 2, tipo: 'rango', min: 25, max: 35 }]
    const salida = aplicarFiltros(rows, filtros)
    expect(salida).toEqual([
      ['Sara', 'Activo', 25],
      ['Álvaro', 'Baja', 35],
      ['Sara', 'activo', 25],
      ['Nuria', '', 0],
    ].filter((f) => (f[2] as number) >= 25 && (f[2] as number) <= 35))
  })

  it('combina varios filtros con AND', () => {
    const filtros: Filtro[] = [
      { col: 1, tipo: 'valores', valores: ['Activo'] },
      { col: 2, tipo: 'rango', min: 30 },
    ]
    const salida = aplicarFiltros(rows, filtros)
    expect(salida).toEqual([['María', 'Activo', 40]])
  })

  it('ignora filtros sin criterio (lista vacia o rango vacio)', () => {
    const filtros: Filtro[] = [
      { col: 1, tipo: 'valores', valores: [] },
      { col: 2, tipo: 'rango' },
    ]
    expect(aplicarFiltros(rows, filtros)).toEqual(rows)
  })

  it('sin filtros devuelve las filas tal cual', () => {
    expect(aplicarFiltros(rows, [])).toEqual(rows)
  })
})


describe('pasaFiltros', () => {
  it('devuelve true sin filtros', () => {
    expect(pasaFiltros(rows[0], [])).toBe(true)
  })

  it('aplica el mismo criterio que aplicarFiltros fila a fila', () => {
    const filtros: Filtro[] = [{ col: 1, tipo: 'valores', valores: ['Activo'] }]
    expect(rows.map((f) => pasaFiltros(f, filtros))).toEqual([true, true, false, true, false])
  })
})
