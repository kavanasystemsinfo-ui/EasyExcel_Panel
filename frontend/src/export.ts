export type ExportPayload = {
  header: string[]
  rows: (string | number | boolean | null)[][]
}

function limpiar(nombre: string): string {
  return nombre.replace(/[\\/:*?"<>|]/g, '_')
}

export function nombreExport(filename: string, sheet: string): string {
  const stem = filename.replace(/\.[^.]+$/, '') || 'libro'
  return `${limpiar(stem)}_${limpiar(sheet)}.xlsx`
}

function escalar(valor: unknown): string | number | boolean | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return valor
  }
  if (valor instanceof Date) return valor.toISOString()
  return String(valor)
}

export function payloadExport(
  header: string[],
  ocultas: number[],
  filas: unknown[][],
): ExportPayload {
  const visibles = header.map((_, i) => i).filter((i) => !ocultas.includes(i))
  return {
    header: visibles.map((i) => header[i]),
    rows: filas.map((fila) => visibles.map((i) => escalar(fila[i]))),
  }
}

export function descargarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
