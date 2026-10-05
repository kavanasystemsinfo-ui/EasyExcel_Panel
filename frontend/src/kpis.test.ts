import { describe, expect, it } from 'vitest'
import { calcularKpis } from './kpis'
import type { SheetData } from './kpis'

const HOY = new Date(2026, 9, 5)

const empleados: SheetData = {
  header: [
    'ID',
    'Nombre Completo',
    'Jornada',
    'Centro Coste',
    'Turno Habitual',
    'Plus Nocturnidad',
    'Estado',
  ],
  rows: [
    ['EMP001', 'Ana Blanco', 'Completa', 'CC01', 'Noche', 50, 'Activo'],
    ['EMP002', 'Luis Ruiz', 'Parcial', 'CC01', 'Mañana', 0, 'Activo'],
    ['EMP003', 'Marta Gil', 'Completa', 'CC02', 'Rotativo', 0, 'Vacaciones'],
    ['EMP004', 'Pepe Mora', 'Completa', 'CC01', 'Tarde', 0, 'Baja Médica'],
    ['EMP005', 'Eva Sanz', 'Parcial', 'CC02', 'Mañana', 0, 'Activo'],
  ],
}

const centros: SheetData = {
  header: ['ID Centro', 'Nombre', 'Plantilla Asignada', 'Estado'],
  rows: [
    ['CC01', 'Hospital Norte', 3, 'Activo'],
    ['CC02', 'Sede Central', 2, 'Inactivo'],
  ],
}

const asignaciones: SheetData = {
  header: ['ID', 'Empleado', 'Centro', 'Fecha Inicio', 'Fecha Fin'],
  rows: [
    ['ASG1', 'EMP001', 'CC01', '2024-01-01T00:00:00', ''],
    ['ASG2', 'EMP002', 'CC01', '2024-02-01T00:00:00', ''],
    ['ASG3', 'EMP005', 'CC02', '2025-01-01T00:00:00', ''],
    ['ASG4', 'EMP003', 'CC02', '2023-01-01T00:00:00', '2024-01-01T00:00:00'],
  ],
}

const vacaciones: SheetData = {
  header: ['ID', 'Empleado', 'Fecha Inicio', 'Fecha Fin', 'Dias Naturales', 'Estado'],
  rows: [
    ['VAC1', 'EMP003', '01/10/2026 0:00:00', '10/10/2026 0:00:00', 10, 'Disfrutada'],
    ['VAC2', 'EMP001', '2026-12-20T00:00:00', '2026-12-30T00:00:00', 11, 'Pendiente'],
    ['VAC3', 'EMP002', '01/08/2026 0:00:00', '05/08/2026 0:00:00', 5, 'Disfrutada'],
    ['VAC4', 'EMP004', '01/11/2026 0:00:00', '04/01/2027 0:00:00', 65, 'Pendiente'],
  ],
}

const maquinaria: SheetData = {
  header: ['ID', 'Tipo', 'Estado', 'Proxima Revision'],
  rows: [
    ['MAQ1', 'Fregadora', 'Operativa', '2026-12-01T00:00:00'],
    ['MAQ2', 'Aspirador', 'Operativa', '2026-10-01T00:00:00'],
    ['MAQ3', 'Elevador', 'En mantenimiento', '2027-01-01T00:00:00'],
  ],
}

const auditorias: SheetData = {
  header: ['ID', 'Puntuacion', 'Resultado'],
  rows: [
    ['AUD1', 80, 'Conforme'],
    ['AUD2', 90, 'Conforme'],
    ['AUD3', 60, 'No Conforme'],
  ],
}

function sheets(): Record<string, SheetData> {
  return {
    Empleados: empleados,
    Centros: centros,
    Asignaciones: asignaciones,
    Vacaciones: vacaciones,
    Maquinaria: maquinaria,
    Auditorias: auditorias,
  }
}

describe('calcularKpis', () => {
  it('calcula plantilla activa desde Empleados', () => {
    const k = calcularKpis(sheets(), HOY).plantilla
    expect(k).toEqual({ activos: 3, total: 5, completas: 3, parciales: 2, bajas: 1 })
  })

  it('calcula centros y asignaciones', () => {
    const k = calcularKpis(sheets(), HOY).centros
    expect(k).toEqual({ activos: 1, total: 2, vigentes: 3, historicas: 4 })
  })

  it('distribuye turnos solo entre activos', () => {
    const k = calcularKpis(sheets(), HOY).turnos
    expect(k).toEqual({ manana: 2, tarde: 0, noche: 1, rotativo: 0, otros: 0, conPlusNoche: 1 })
  })

  it('cuenta vacaciones en disfrute hoy y pendientes', () => {
    const k = calcularKpis(sheets(), HOY).vacaciones
    expect(k?.hoy).toBe(1)
    expect(k?.pendientes).toBe(2)
    expect(k?.maxDias).toBe(65)
    expect(k?.cumple30).toBe(false)
  })

  it('calcula maquinaria operativa y revisiones vencidas', () => {
    const k = calcularKpis(sheets(), HOY).maquinaria
    expect(k).toEqual({ operativas: 2, total: 3, pct: 67, vencidas: 1, proximas30: 0 })
  })

  it('calcula calidad media y conformes', () => {
    const k = calcularKpis(sheets(), HOY).calidad
    expect(k).toEqual({ media: 77, total: 3, conformes: 2 })
  })

  it('calcula cobertura activos vs plantilla por centro', () => {
    const c = calcularKpis(sheets(), HOY).cobertura
    expect(c).toEqual([
      { nombre: 'Hospital Norte', activos: 2, plantilla: 3 },
      { nombre: 'Sede Central', activos: 1, plantilla: 2 },
    ])
  })

  it('sin hojas de datos no inventa kpis', () => {
    const k = calcularKpis({ Info: { header: ['a'], rows: [['x']] } }, HOY)
    expect(k.plantilla).toBeUndefined()
    expect(k.cobertura).toBeUndefined()
  })
})
