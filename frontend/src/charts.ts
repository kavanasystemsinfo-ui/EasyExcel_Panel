import { norm, parseFecha } from './cells'
import { indice, type SheetData } from './kpis'

export type Punto = { etiqueta: string; valor: number }

export type Grafico = {
  id: string
  titulo: string
  tipo: 'barras' | 'donut'
  puntos: Punto[]
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function contarPorColumna(
  sheet: SheetData | undefined,
  colNombre: string,
  limite = 8,
): Punto[] {
  if (!sheet) return []
  const col = indice(sheet.header, colNombre)
  if (col < 0) return []
  const grupos = new Map<string, Punto>()
  for (const fila of sheet.rows) {
    const crudo = String(fila[col] ?? '').trim()
    if (!crudo) continue
    const clave = norm(crudo)
    const grupo = grupos.get(clave)
    if (grupo) grupo.valor++
    else grupos.set(clave, { etiqueta: crudo, valor: 1 })
  }
  return [...grupos.values()]
    .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, 'es'))
    .slice(0, limite)
}

export function vacacionesPorMes(sheet: SheetData | undefined): Punto[] {
  if (!sheet) return []
  const col = indice(sheet.header, 'Fecha Inicio', 'Fecha')
  if (col < 0) return []
  const conteo = new Array<number>(12).fill(0)
  let hayFecha = false
  for (const fila of sheet.rows) {
    const fecha = parseFecha(fila[col])
    if (!fecha) continue
    conteo[fecha.getMonth()]++
    hayFecha = true
  }
  if (!hayFecha) return []
  return conteo
    .map((valor, mes) => ({ etiqueta: MESES[mes], valor }))
    .filter((punto) => punto.valor > 0)
}

const DEFINICIONES = [
  { id: 'empleados-estado', titulo: 'Empleados por estado', tipo: 'barras', hoja: 'Empleados', col: 'Estado' },
  { id: 'contratos-tipo', titulo: 'Tipos de contrato', tipo: 'barras', hoja: 'Contratos', col: 'Tipo' },
  { id: 'vacaciones-estado', titulo: 'Vacaciones por estado', tipo: 'donut', hoja: 'Vacaciones', col: 'Estado' },
  { id: 'auditorias-resultado', titulo: 'Auditorías por resultado', tipo: 'donut', hoja: 'Auditorias', col: 'Resultado' },
] as const

export function generarGraficos(data: Record<string, SheetData>): Grafico[] {
  const graficos: Grafico[] = []
  for (const def of DEFINICIONES) {
    const puntos = contarPorColumna(data[def.hoja], def.col)
    if (puntos.length > 0) {
      graficos.push({ id: def.id, titulo: def.titulo, tipo: def.tipo, puntos })
    }
  }
  const meses = vacacionesPorMes(data['Vacaciones'])
  if (meses.length > 0) {
    graficos.push({ id: 'vacaciones-mes', titulo: 'Vacaciones por mes', tipo: 'barras', puntos: meses })
  }
  return graficos
}
