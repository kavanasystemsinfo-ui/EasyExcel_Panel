import { formatCelda } from './cells'
import { norm, num, parseFecha } from './cells'
import { analizarColumnas } from './insights'
import { esColumnaNumerica, valoresDistintos, type ValorDistinto } from './filters'

export const MAX_MUESTRA_FILAS = 15
export const MAX_CONTEOS_COLUMNAS = 8
export const MAX_CONTEOS_VALORES = 40
export const MAX_CELDA = 60
export const MAX_COLUMNAS_NUMERICAS = 8
export const MAX_CRUCES = 6
export const MAX_GRUPOS_CRUCE = 10

export type Estadistica = { n: number; suma: number; media: number; min: number; max: number }

export type ContextoCopiloto = {
  hoja: string
  seccion: string
  filtros: string[]
  kpis: unknown
  alertas: string[]
  conteos: Record<string, ValorDistinto[]>
  muestra: { header: string[]; filas: string[][] }
  total_filas: number
  estadisticas: Record<string, Estadistica>
  cruces: Record<string, { grupo: string; suma: number; filas: number }[]>
  rangos_fechas: Record<string, [string, string]>
}

export type EntradaContexto = {
  hoja: string
  seccion: string
  filtros: string[]
  kpis: unknown
  alertas: string[]
  header: string[]
  filas: unknown[][]
}

function truncar(texto: string): string {
  return texto.length > MAX_CELDA ? `${texto.slice(0, MAX_CELDA - 1)}…` : texto
}

const redondear = (n: number) => Math.round(n * 100) / 100

// Cifras calculadas sobre TODAS las filas visibles (no solo la muestra), para que
// el copiloto no tenga que sumar de cabeza ni invente totales.
function resumenNumerico(header: string[], filas: unknown[][]) {
  const cols = analizarColumnas({ header, rows: filas })
  const numericas = cols.filter((c) => c.tipo === 'numerica').slice(0, MAX_COLUMNAS_NUMERICAS)
  const categoricas = cols.filter((c) => c.tipo === 'categorica')

  const estadisticas: Record<string, Estadistica> = {}
  for (const col of numericas) {
    let n = 0
    let suma = 0
    let min = Infinity
    let max = -Infinity
    for (const fila of filas) {
      const v = num(fila[col.idx])
      if (!Number.isFinite(v)) continue
      n++
      suma += v
      if (v < min) min = v
      if (v > max) max = v
    }
    if (n > 0) {
      estadisticas[col.nombre] = {
        n,
        suma: redondear(suma),
        media: redondear(suma / n),
        min: redondear(min),
        max: redondear(max),
      }
    }
  }

  const cruces: ContextoCopiloto['cruces'] = {}
  let total = 0
  for (const cat of categoricas) {
    for (const numCol of numericas.slice(0, 2)) {
      if (total >= MAX_CRUCES) break
      const grupos = new Map<string, { grupo: string; suma: number; filas: number }>()
      for (const fila of filas) {
        const crudo = String(fila[cat.idx] ?? '').trim()
        const v = num(fila[numCol.idx])
        if (!crudo || !Number.isFinite(v)) continue
        const g = grupos.get(norm(crudo)) ?? { grupo: crudo, suma: 0, filas: 0 }
        g.suma += v
        g.filas++
        grupos.set(norm(crudo), g)
      }
      if (grupos.size < 2) continue
      cruces[`${numCol.nombre} por ${cat.nombre}`] = [...grupos.values()]
        .map((g) => ({ ...g, suma: redondear(g.suma) }))
        .sort((a, b) => b.suma - a.suma)
        .slice(0, MAX_GRUPOS_CRUCE)
      total++
    }
  }

  const rangos: ContextoCopiloto['rangos_fechas'] = {}
  for (const col of cols.filter((c) => c.tipo === 'fecha').slice(0, 3)) {
    let min: Date | null = null
    let max: Date | null = null
    for (const fila of filas) {
      const f = parseFecha(fila[col.idx])
      if (!f) continue
      if (!min || f < min) min = f
      if (!max || f > max) max = f
    }
    if (min && max) rangos[col.nombre] = [min.toISOString().slice(0, 10), max.toISOString().slice(0, 10)]
  }
  return { estadisticas, cruces, rangos }
}

export function construirContexto(entrada: EntradaContexto): ContextoCopiloto {
  const { hoja, seccion, filtros, kpis, alertas, header, filas } = entrada

  const muestraFilas = filas
    .slice(0, MAX_MUESTRA_FILAS)
    .map((fila) => header.map((col, c) => truncar(formatCelda(col, fila[c]))))

  const conteos: Record<string, ValorDistinto[]> = {}
  let columnas = 0
  for (let c = 0; c < header.length && columnas < MAX_CONTEOS_COLUMNAS; c++) {
    if (esColumnaNumerica(filas, c)) continue
    const valores = valoresDistintos(filas, c)
    if (!valores.length || valores.length > MAX_CONTEOS_VALORES) continue
    conteos[header[c]] = valores
    columnas++
  }

  const { estadisticas, cruces, rangos } = resumenNumerico(header, filas)

  return {
    hoja,
    seccion,
    filtros,
    kpis,
    alertas,
    conteos,
    muestra: { header, filas: muestraFilas },
    total_filas: filas.length,
    estadisticas,
    cruces,
    rangos_fechas: rangos,
  }
}
