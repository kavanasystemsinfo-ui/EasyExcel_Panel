import { formatCelda } from './cells'
import { esColumnaNumerica, valoresDistintos, type ValorDistinto } from './filters'

export const MAX_MUESTRA_FILAS = 15
export const MAX_CONTEOS_COLUMNAS = 8
export const MAX_CONTEOS_VALORES = 40
export const MAX_CELDA = 60

export type ContextoCopiloto = {
  hoja: string
  seccion: string
  filtros: string[]
  kpis: unknown
  alertas: string[]
  conteos: Record<string, ValorDistinto[]>
  muestra: { header: string[]; filas: string[][] }
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

  return {
    hoja,
    seccion,
    filtros,
    kpis,
    alertas,
    conteos,
    muestra: { header, filas: muestraFilas },
  }
}
