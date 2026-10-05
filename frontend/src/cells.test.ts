import { describe, expect, it } from 'vitest'
import { formatFecha, formatMoneda, tonoEstado } from './cells'

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
