import { norm, num } from './cells'

export type Filtro =
  | { col: number; tipo: 'valores'; valores: string[] }
  | { col: number; tipo: 'rango'; min?: number; max?: number }

export type ValorDistinto = { valor: string; conteo: number }

export function valoresDistintos(rows: unknown[][], col: number): ValorDistinto[] {
  const grupos = new Map<string, ValorDistinto>()
  for (const fila of rows) {
    const crudo = String(fila[col] ?? '').trim()
    if (!crudo) continue
    const clave = norm(crudo)
    const grupo = grupos.get(clave)
    if (grupo) grupo.conteo++
    else grupos.set(clave, { valor: crudo, conteo: 1 })
  }
  return [...grupos.values()].sort((a, b) => a.valor.localeCompare(b.valor, 'es'))
}

export function esColumnaNumerica(rows: unknown[][], col: number): boolean {
  let numeros = 0
  let texto = 0
  for (const fila of rows) {
    const crudo = fila[col]
    if (crudo === null || crudo === undefined || String(crudo).trim() === '') continue
    if (typeof crudo === 'number' || (typeof crudo === 'string' && Number.isFinite(num(crudo)))) {
      numeros++
    } else {
      texto++
    }
  }
  return numeros > 0 && texto === 0
}

export function pasaFiltros(fila: unknown[], filtros: Filtro[]): boolean {
  for (const filtro of filtros) {
    if (filtro.tipo === 'valores') {
      if (filtro.valores.length === 0) continue
      const claves = new Set(filtro.valores.map(norm))
      if (!claves.has(norm(fila[filtro.col]))) return false
    } else {
      if (filtro.min === undefined && filtro.max === undefined) continue
      const n = num(fila[filtro.col])
      if (!Number.isFinite(n)) return false
      if (filtro.min !== undefined && n < filtro.min) return false
      if (filtro.max !== undefined && n > filtro.max) return false
    }
  }
  return true
}

export function aplicarFiltros(rows: unknown[][], filtros: Filtro[]): unknown[][] {
  if (filtros.length === 0) return rows
  return rows.filter((fila) => pasaFiltros(fila, filtros))
}

export function resumenFiltros(
  header: string[],
  query: string,
  soloActivos: boolean,
  filtros: Filtro[],
): string[] {
  const partes: string[] = []
  const texto = query.trim()
  if (texto) partes.push(`Búsqueda: ${texto}`)
  if (soloActivos) partes.push('Solo activos')
  for (const filtro of filtros) {
    const col = header[filtro.col] ?? `Columna ${filtro.col + 1}`
    if (filtro.tipo === 'valores') {
      partes.push(`${col}: ${filtro.valores.join(', ')}`)
    } else {
      const min = filtro.min !== undefined ? String(filtro.min) : '…'
      const max = filtro.max !== undefined ? String(filtro.max) : '…'
      partes.push(`${col} ${min}–${max}`)
    }
  }
  return partes
}
