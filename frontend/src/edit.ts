import { norm } from './cells'

export type HojaEditada = { name: string; header: string[]; rows: unknown[][] }

export type WorkbookFull = {
  id: string
  filename: string
  uploaded_at: string
  hojas: HojaEditada[]
}

export const MAX_COLS = 200
export const MAX_ROWS = 100_000

export function hojaDe(wb: WorkbookFull, nombre: string): HojaEditada {
  const hoja = wb.hojas.find((h) => h.name === nombre)
  if (!hoja) throw new Error(`La hoja '${nombre}' no existe`)
  return hoja
}

function indiceColumna(header: string[], col: number): void {
  if (col < 0 || col >= header.length) {
    throw new Error(`La columna ${col + 1} no existe`)
  }
}

function indiceFila(rows: unknown[][], fila: number): void {
  if (fila < 0 || fila >= rows.length) {
    throw new Error(`La fila ${fila + 1} no existe`)
  }
}

function nombreDisponible(header: string[], nombre: string): void {
  const limpio = nombre.trim()
  if (!limpio) throw new Error('El nombre de la columna no puede estar vacío')
  if (header.some((col) => norm(col) === norm(limpio))) {
    throw new Error(`Ya existe una columna llamada '${limpio}'`)
  }
}

function clonar(wb: WorkbookFull): WorkbookFull {
  return structuredClone(wb)
}

function conHoja(
  wb: WorkbookFull,
  nombre: string,
  cambiar: (hoja: HojaEditada) => void,
): WorkbookFull {
  const next = clonar(wb)
  cambiar(hojaDe(next, nombre))
  return next
}

export function editarCelda(
  wb: WorkbookFull,
  nombre: string,
  fila: number,
  col: number,
  valor: unknown,
): WorkbookFull {
  return conHoja(wb, nombre, (hoja) => {
    indiceColumna(hoja.header, col)
    indiceFila(hoja.rows, fila)
    hoja.rows[fila][col] = valor
  })
}

export function anadirColumna(
  wb: WorkbookFull,
  nombre: string,
  nueva: string,
): WorkbookFull {
  const hoja = hojaDe(wb, nombre)
  if (hoja.header.length >= MAX_COLS) {
    throw new Error(`Limite alcanzado: ${MAX_COLS} columnas por hoja`)
  }
  nombreDisponible(hoja.header, nueva)
  return conHoja(wb, nombre, (h) => {
    h.header.push(nueva.trim())
    for (const fila of h.rows) fila.push('')
  })
}

export function anadirFila(
  wb: WorkbookFull,
  nombre: string,
  valores?: unknown[],
): WorkbookFull {
  const hoja = hojaDe(wb, nombre)
  if (hoja.rows.length >= MAX_ROWS) {
    throw new Error(`Limite alcanzado: ${MAX_ROWS} filas por hoja`)
  }
  return conHoja(wb, nombre, (h) => {
    const fila = Array.from({ length: h.header.length }, (_, i) => valores?.[i] ?? '')
    h.rows.push(fila)
  })
}

export function borrarFila(wb: WorkbookFull, nombre: string, fila: number): WorkbookFull {
  return conHoja(wb, nombre, (h) => {
    indiceFila(h.rows, fila)
    h.rows.splice(fila, 1)
  })
}

export function borrarColumna(wb: WorkbookFull, nombre: string, col: number): WorkbookFull {
  return conHoja(wb, nombre, (h) => {
    indiceColumna(h.header, col)
    h.header.splice(col, 1)
    for (const fila of h.rows) fila.splice(col, 1)
  })
}

export function renombrarColumna(
  wb: WorkbookFull,
  nombre: string,
  col: number,
  nuevo: string,
): WorkbookFull {
  const hoja = hojaDe(wb, nombre)
  indiceColumna(hoja.header, col)
  const otros = hoja.header.filter((_, i) => i !== col)
  nombreDisponible(otros, nuevo)
  return conHoja(wb, nombre, (h) => {
    h.header[col] = nuevo.trim()
  })
}
