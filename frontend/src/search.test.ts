import { describe, expect, it } from 'vitest'
import { buscarEnLibro, type Coincidencia } from './search'

const hojas = [
  {
    name: 'Empleados',
    header: ['ID', 'Nombre', 'Estado'],
    rows: [
      ['EMP001', 'Sara Fernández', 'Activo'],
      ['EMP002', 'María Torres', 'Baja'],
    ],
  },
  {
    name: 'Centros',
    header: ['ID', 'Nombre'],
    rows: [['CC01', 'Sara Limpieza']],
  },
]

describe('buscarEnLibro', () => {
  it('encuentra coincidencias en varias hojas con su hoja y posicion', () => {
    const { coincidencias, total } = buscarEnLibro(hojas, 'sara')
    expect(total).toBe(2)
    const resumen: Omit<Coincidencia, 'celda'>[] = coincidencias.map(
      ({ hoja, fila, col }) => ({ hoja, fila, col }),
    )
    expect(resumen).toEqual([
      { hoja: 'Empleados', fila: 0, col: 1 },
      { hoja: 'Centros', fila: 0, col: 1 },
    ])
  })

  it('es insensible a tildes y mayusculas', () => {
    expect(buscarEnLibro(hojas, 'MARIA').total).toBe(1)
    expect(buscarEnLibro(hojas, 'maría').total).toBe(1)
  })

  it('respeta el limite pero cuenta el total completo', () => {
    const { coincidencias, total } = buscarEnLibro(hojas, 'emp', 1)
    expect(total).toBe(2)
    expect(coincidencias).toHaveLength(1)
  })

  it('devuelve vacio sin texto o sin coincidencias', () => {
    expect(buscarEnLibro(hojas, '   ')).toEqual({ coincidencias: [], total: 0 })
    expect(buscarEnLibro(hojas, 'zzz')).toEqual({ coincidencias: [], total: 0 })
  })

  it('busca solo en celdas, no en cabeceras', () => {
    expect(buscarEnLibro(hojas, 'centros').total).toBe(0)
  })

  it('incluye el texto de la celda recortado', () => {
    const { coincidencias } = buscarEnLibro(hojas, 'sara')
    expect(coincidencias[0].celda).toBe('Sara Fernández')
  })
})
