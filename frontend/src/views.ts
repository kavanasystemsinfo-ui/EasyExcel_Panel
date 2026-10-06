import type { Grafico } from './charts'
import type { Kpis } from './kpis'

export type Seccion = 'resumen' | 'personal' | 'operaciones' | 'datos'

export const SECCIONES: { id: Seccion; nombre: string; icono: string }[] = [
  { id: 'resumen', nombre: 'Resumen', icono: 'space_dashboard' },
  { id: 'personal', nombre: 'Personal', icono: 'badge' },
  { id: 'operaciones', nombre: 'Operaciones', icono: 'engineering' },
  { id: 'datos', nombre: 'Datos', icono: 'table_view' },
]

export const ES_SECCION = (valor: string): valor is Seccion =>
  SECCIONES.some((s) => s.id === valor)

const DOMINIO: Record<'personal' | 'operaciones', string[]> = {
  personal: ['Empleados', 'Contratos', 'Vacaciones', 'Asignaciones'],
  operaciones: ['Centros', 'Auditorias', 'Maquinaria', 'Revisiones', 'Proveedores'],
}

export function hojasDeSeccion(seccion: Seccion, nombres: string[]): string[] {
  if (seccion === 'resumen') return []
  if (seccion === 'datos') return nombres
  const propias = DOMINIO[seccion].filter((n) => nombres.includes(n))
  return propias.length ? propias : nombres
}

export function kpisDeSeccion(seccion: Seccion): string[] | null {
  switch (seccion) {
    case 'resumen':
      return null
    case 'personal':
      return ['plantilla', 'turnos', 'vacaciones']
    case 'operaciones':
      return ['centros', 'maquinaria', 'calidad']
    case 'datos':
      return []
  }
}

const GRAFICOS_POR_SECCION: Record<Exclude<Seccion, 'datos'>, string[]> = {
  resumen: ['empleados-estado', 'vacaciones-mes'],
  personal: ['contratos-tipo', 'vacaciones-estado'],
  operaciones: ['auditorias-resultado'],
}

export function graficosDeSeccion(seccion: Seccion, disponibles: Grafico[]): Grafico[] {
  if (seccion === 'datos') return []
  const preferidos = GRAFICOS_POR_SECCION[seccion]
  const elegidos = preferidos
    .map((id) => disponibles.find((g) => g.id === id))
    .filter((g): g is Grafico => g !== undefined)
  if (elegidos.length) return elegidos
  return disponibles.slice(0, 2)
}

export type Alerta = {
  id: 'bajas' | 'vacaciones' | 'vencidas' | 'proximas' | 'sin-incidencias'
  tono: 'danger' | 'warn' | 'info' | 'ok'
  texto: string
}

export function alertasDeSeccion(kpis: Kpis): Alerta[] {
  const out: Alerta[] = []
  const bajas = kpis.plantilla?.bajas ?? 0
  if (bajas > 0) {
    out.push({ id: 'bajas', tono: 'danger', texto: `${bajas} baja${bajas === 1 ? '' : 's'} en plantilla` })
  }
  const pendientes = kpis.vacaciones?.pendientes ?? 0
  if (pendientes > 0) {
    out.push({
      id: 'vacaciones',
      tono: 'warn',
      texto: `${pendientes} solicitudes de vacaciones pendientes`,
    })
  }
  const vencidas = kpis.maquinaria?.vencidas ?? 0
  const proximas = kpis.maquinaria?.proximas30 ?? 0
  if (vencidas > 0) {
    out.push({
      id: 'vencidas',
      tono: 'danger',
      texto: `${vencidas} revisiones de maquinaria vencidas`,
    })
  } else if (proximas > 0) {
    out.push({
      id: 'proximas',
      tono: 'info',
      texto: `${proximas} revisiones de maquinaria en 30 días`,
    })
  }
  if (!out.length) {
    out.push({ id: 'sin-incidencias', tono: 'ok', texto: 'Sin incidencias pendientes' })
  }
  return out
}
