import { describe, expect, it } from 'vitest'
import { formatFecha, formatMoneda, num, tonoEstado } from './cells'

describe('formatMoneda', () => {
  it('formatea euros en es-ES', () => {
    expect(formatMoneda(1428.5)).toBe('1.428,50 €')
  })

  it('devuelve vacio para valores no numericos', () => {
    expect(formatMoneda('n/a')).toBe('')
    expect(formatMoneda('')).toBe('')
    expect(formatMoneda(null)).toBe('')
  })
})

describe('formatFecha', () => {
  it('acepta ISO del backend', () => {
    expect(formatFecha('2026-07-25T00:00:00')).toBe('25/07/2026')
  })

  it('acepta fechas en texto dd/MM/yyyy', () => {
    expect(formatFecha('05/10/2026 0:00:00')).toBe('05/10/2026')
  })

  it('devuelve vacio para huecos', () => {
    expect(formatFecha('')).toBe('')
    expect(formatFecha(null)).toBe('')
  })
})

describe('tonoEstado', () => {
  it('mapea estados a tonos semanticos', () => {
    expect(tonoEstado('Activo')).toBe('ok')
    expect(tonoEstado('Conforme')).toBe('ok')
    expect(tonoEstado('Operativa')).toBe('ok')
    expect(tonoEstado('Vacaciones')).toBe('info')
    expect(tonoEstado('Disfrutada')).toBe('info')
    expect(tonoEstado('Pendiente')).toBe('warn')
    expect(tonoEstado('En mantenimiento')).toBe('warn')
    expect(tonoEstado('Baja Médica')).toBe('danger')
    expect(tonoEstado('No Conforme')).toBe('danger')
    expect(tonoEstado('Desconocido')).toBe('neutral')
  })
})

describe('num', () => {
  it.each([
    ['21.500,00', 21500],
    ['125.5', 125.5],
    ['125,5', 125.5],
    ['0.75', 0.75],
    ['12.50', 12.5],
    ['3.1416', 3.1416],
    ['1.234.567', 1234567],
    ['1.234.567,89', 1234567.89],
    ['1,234,567.89', 1234567.89],
    ['21.500', 21500],
    ['1 250,5', 1250.5],
    ['-45,3', -45.3],
    ['1.250 €', 1250],
    ['$ 99.95', 99.95],
  ])('lee %s como %d', (texto, esperado) => {
    expect(num(texto)).toBe(esperado)
  })

  it('devuelve NaN para texto que no es numero', () => {
    expect(Number.isNaN(num('n/a'))).toBe(true)
    expect(Number.isNaN(num(''))).toBe(true)
    expect(Number.isNaN(num('12abc'))).toBe(true)
    expect(Number.isNaN(num('1.2.3.4x'))).toBe(true)
  })
})
