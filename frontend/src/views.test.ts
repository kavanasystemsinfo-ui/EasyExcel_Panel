import { describe, expect, it } from 'vitest'
import type { Grafico } from './charts'
import {
  alertasDeSeccion,
  graficosDeSeccion,
  hojasDeSeccion,
  kpisDeSeccion,
  SECCIONES,
  type Seccion,
} from './views'

const HOJAS = [
  'Info',
  'Empleados',
  'Centros',
  'Asignaciones',
  'Contratos',
  'Vacaciones',
  'Proveedores',
  'Auditorias',
  'Maquinaria',
  'Revisiones',
]

const grafico = (id: string): Grafico => ({
  id,
  titulo: id,
  tipo: 'barras',
  puntos: [{ etiqueta: 'a', valor: 1 }],
})

describe('SECCIONES', () => {
  it('define las cuatro vistas con su icono', () => {
    expect(SECCIONES.map((s) => s.id)).toEqual([
      'resumen',
      'personal',
      'operaciones',
      'datos',
    ])
    expect(SECCIONES[0].nombre).toBe('Resumen')
    expect(SECCIONES.every((s) => s.icono.length > 0)).toBe(true)
  })
})

describe('hojasDeSeccion', () => {
  it('no muestra hojas en resumen', () => {
    expect(hojasDeSeccion('resumen', HOJAS)).toEqual([])
  })

  it('muestra todas las hojas en datos', () => {
    expect(hojasDeSeccion('datos', HOJAS)).toEqual(HOJAS)
  })

  it('filtra al dominio de personal', () => {
    expect(hojasDeSeccion('personal', HOJAS)).toEqual([
      'Empleados',
      'Contratos',
      'Vacaciones',
      'Asignaciones',
    ])
  })

  it('filtra al dominio de operaciones', () => {
    expect(hojasDeSeccion('operaciones', HOJAS)).toEqual([
      'Centros',
      'Auditorias',
      'Maquinaria',
      'Revisiones',
      'Proveedores',
    ])
  })

  it('vuelve a todas las hojas si el dominio no existe en el libro', () => {
    const propias = ['Clientes', 'Pedidos']
    expect(hojasDeSeccion('personal', propias)).toEqual(propias)
    expect(hojasDeSeccion('operaciones', propias)).toEqual(propias)
  })
})

describe('kpisDeSeccion', () => {
  it('en resumen manda todos los KPIs', () => {
    expect(kpisDeSeccion('resumen')).toBeNull()
  })

  it('en personal solo los suyos', () => {
    expect(kpisDeSeccion('personal')).toEqual(['plantilla', 'turnos', 'vacaciones'])
  })

  it('en operaciones solo los suyos', () => {
    expect(kpisDeSeccion('operaciones')).toEqual(['centros', 'maquinaria', 'calidad'])
  })

  it('en datos no hay tarjetas de KPI', () => {
    expect(kpisDeSeccion('datos')).toEqual([])
  })
})

describe('graficosDeSeccion', () => {
  const disponibles = [
    grafico('contratos-tipo'),
    grafico('vacaciones-mes'),
    grafico('empleados-estado'),
    grafico('vacaciones-estado'),
    grafico('auditorias-resultado'),
  ]

  it('en datos no se muestran graficos', () => {
    expect(graficosDeSeccion('datos', disponibles)).toEqual([])
  })

  it('resumen prioriza empleados-estado y vacaciones-mes en ese orden', () => {
    const ids = graficosDeSeccion('resumen', disponibles).map((g) => g.id)
    expect(ids).toEqual(['empleados-estado', 'vacaciones-mes'])
  })

  it('personal y operaciones reparten el resto', () => {
    expect(graficosDeSeccion('personal', disponibles).map((g) => g.id)).toEqual([
      'contratos-tipo',
      'vacaciones-estado',
    ])
    expect(graficosDeSeccion('operaciones', disponibles).map((g) => g.id)).toEqual([
      'auditorias-resultado',
    ])
  })

  it('si el libro no trae los graficos preferidos, usa los disponibles', () => {
    const ajenos = [grafico('ventas-region'), grafico('stock-tipo')]
    const salida = graficosDeSeccion('resumen', ajenos)
    expect(salida.map((g) => g.id)).toEqual(['ventas-region', 'stock-tipo'])
  })
})

describe('alertasDeSeccion', () => {
  it('sin KPIs calculados no hay alertas', () => {
    expect(alertasDeSeccion({})).toEqual([
      { id: 'sin-incidencias', tono: 'ok', texto: 'Sin incidencias pendientes' },
    ])
  })

  it('agrupa bajas, pendientes y maquinaria', () => {
    const alertas = alertasDeSeccion({
      plantilla: { activos: 10, total: 12, completas: 8, parciales: 2, bajas: 2 },
      vacaciones: { hoy: 3, pendientes: 59, cumple30: true, maxDias: 30 },
      maquinaria: { operativas: 43, total: 51, pct: 84, proximas30: 15, vencidas: 2 },
    })
    expect(alertas).toEqual([
      { id: 'bajas', tono: 'danger', texto: '2 bajas en plantilla' },
      { id: 'vacaciones', tono: 'warn', texto: '59 solicitudes de vacaciones pendientes' },
      { id: 'vencidas', tono: 'danger', texto: '2 revisiones de maquinaria vencidas' },
    ])
  })

  it('avisa de revisiones proximas si no hay vencidas', () => {
    const alertas = alertasDeSeccion({
      maquinaria: { operativas: 50, total: 51, pct: 98, proximas30: 15, vencidas: 0 },
    })
    expect(alertas).toEqual([
      { id: 'proximas', tono: 'info', texto: '15 revisiones de maquinaria en 30 días' },
    ])
  })
})

describe('nombres de seccion para el sidebar', () => {
  it('cada seccion tiene nombre legible', () => {
    const ids: Seccion[] = ['resumen', 'personal', 'operaciones', 'datos']
    for (const id of ids) {
      const s = SECCIONES.find((x) => x.id === id)
      expect(s?.nombre).toBeTruthy()
    }
  })
})
