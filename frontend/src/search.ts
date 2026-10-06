import { norm } from './cells'

export type HojaBusqueda = { name: string; header: string[]; rows: unknown[][] }

export type Coincidencia = { hoja: string; fila: number; col: number; celda: string }

export type ResultadoBusqueda = { coincidencias: Coincidencia[]; total: number }

export function buscarEnLibro(
  hojas: HojaBusqueda[],
  texto: string,
  limite = 50,
): ResultadoBusqueda {
  const q = norm(texto)
  const coincidencias: Coincidencia[] = []
  let total = 0
  if (!q) return { coincidencias, total }
  for (const hoja of hojas) {
    for (let fila = 0; fila < hoja.rows.length; fila++) {
      const datos = hoja.rows[fila]
      for (let col = 0; col < datos.length; col++) {
        const crudo = String(datos[col] ?? '')
        if (!norm(crudo).includes(q)) continue
        total++
        if (coincidencias.length < limite) {
          coincidencias.push({ hoja: hoja.name, fila, col, celda: crudo.slice(0, 80) })
        }
      }
    }
  }
  return { coincidencias, total }
}
