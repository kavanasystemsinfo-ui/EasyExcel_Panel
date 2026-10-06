import { describe, expect, it } from 'vitest'
import { contarPorColumna, generarGraficos, vacacionesPorMes } from './charts'
import type { SheetData } from './kpis'

const vacaciones: SheetData = {
  header: ['ID', 'Fecha Inicio', 'Estado'],
  rows: [
    ['V1', '25/07/2026 0:00:00', 'Disfrutada'],
    ['V2', '03/08/2026 0:00:00', 'Pendiente'],
    ['V3', '15/12/2026 0:00:00', 'Disfrutada'],
    ['V4', '01/07/2026 0:00:00', 'Rechazada'],
    ['V5', 'no-fecha', 'Pendiente'],
  ],
}

const contratos: SheetData = {
  header: ['ID', 'Tipo'],
  rows: [
    ['C1', 'Temporal'],
    ['C2', 'Indefinido'],
    ['C3', 'Indefinido'],
  ],
}

describe('contarPorColumna', () => {
  it('agrupa y ordena de mayor a menor', () => {
    const puntos = contarPorColumna(contratos, 'Tipo')
    expect(puntos).toEqual([
      { etiqueta: 'Indefinido', valor: 2 },
      { etiqueta: 'Temporal', valor: 1 },
    ])
  })

  it('ignora celdas vacias', () => {
    const sheet: SheetData = { header: ['E'], rows: [['Activo'], [''], [null], ['Baja']] }
    expect(contarPorColumna(sheet, 'E')).toEqual([
      { etiqueta: 'Activo', valor: 1 },
      { etiqueta: 'Baja', valor: 1 },
    ])
  })

  it('respeta el limite de etiquetas', () => {
    const sheet: SheetData = {
      header: ['E'],
      rows: [['a'], ['a'], ['b'], ['c'], ['d'], ['e'], ['f'], ['g'], ['h'], ['i']],
    }
    expect(contarPorColumna(sheet, 'E', 3)).toEqual([
      { etiqueta: 'a', valor: 2 },
      { etiqueta: 'b', valor: 1 },
      { etiqueta: 'c', valor: 1 },
    ])
  })

  it('devuelve vacio si la hoja o la columna no existen', () => {
    expect(contarPorColumna(undefined, 'Estado')).toEqual([])
    expect(contarPorColumna(contratos, 'Inexistente')).toEqual([])
  })
})

describe('vacacionesPorMes', () => {
  it('cuenta las peticiones por mes de inicio', () => {
    expect(vacacionesPorMes(vacaciones)).toEqual([
      { etiqueta: 'jul', valor: 2 },
      { etiqueta: 'ago', valor: 1 },
      { etiqueta: 'dic', valor: 1 },
    ])
  })

  it('devuelve vacio sin hoja o sin fechas validas', () => {
    expect(vacacionesPorMes(undefined)).toEqual([])
    expect(vacacionesPorMes({ header: ['F'], rows: [['x']] })).toEqual([])
  })
})

describe('generarGraficos', () => {
  it('genera los graficos del demo con datos reales', () => {
    const data: Record<string, SheetData> = { Vacaciones: vacaciones, Contratos: contratos }
    const graficos = generarGraficos(data)
    const ids = graficos.map((g) => g.id)
    expect(ids).toEqual(['contratos-tipo', 'vacaciones-estado', 'vacaciones-mes'])
    const donut = graficos.find((g) => g.id === 'vacaciones-estado')
    expect(donut?.tipo).toBe('donut')
    expect(donut?.puntos[0]).toEqual({ etiqueta: 'Disfrutada', valor: 2 })
  })

  it('omite los graficos sin hoja y devuelve vacio en un libro generico', () => {
    expect(generarGraficos({ Hoja: { header: ['A'], rows: [['1']] } })).toEqual([])
    expect(generarGraficos({})).toEqual([])
  })
})
