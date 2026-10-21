import { norm, num, parseFecha } from './cells'
import type { Grafico } from './charts'
import type { SheetData } from './kpis'
import type { Alerta, Seccion } from './views'

const HOJAS_DEMO = ['Empleados', 'Centros', 'Vacaciones', 'Contratos', 'Auditorias', 'Maquinaria']

export function esLibroDemo(nombres: string[]): boolean {
  return nombres.some((n) => HOJAS_DEMO.includes(n))
}

export function seccionesDeLibro(nombres: string[]): { id: Seccion; nombre: string; icono: string }[] {
  if (esLibroDemo(nombres)) {
    return [
      { id: 'resumen', nombre: 'Resumen', icono: 'space_dashboard' },
      { id: 'personal', nombre: 'Personal', icono: 'badge' },
      { id: 'operaciones', nombre: 'Operaciones', icono: 'engineering' },
      { id: 'datos', nombre: 'Datos', icono: 'table_view' },
    ]
  }
  return [
    { id: 'resumen', nombre: 'Resumen', icono: 'space_dashboard' },
    { id: 'datos', nombre: 'Datos', icono: 'table_view' },
  ]
}

type ColInfo = {
  nombre: string
  idx: number
  tipo: 'numerica' | 'fecha' | 'categorica' | 'id' | 'texto'
  cardinalidad: number
  noVacios: number
  vacios: number
}

function analizarColumnas(sheet: SheetData): ColInfo[] {
  const total = sheet.rows.length
  return sheet.header.map((nombre, idx) => {
    let noVacios = 0
    let nums = 0
    let fechas = 0
    const distintos = new Set<string>()
    for (const fila of sheet.rows) {
      const celda = fila[idx]
      const crudo = String(celda ?? '').trim()
      if (!crudo) continue
      noVacios++
      distintos.add(norm(crudo))
      if (typeof celda === 'number' || (typeof celda === 'string' && Number.isFinite(num(celda)))) nums++
      if (parseFecha(celda)) fechas++
    }
    const vacios = total - noVacios
    const cardinalidad = distintos.size
    let tipo: ColInfo['tipo'] = 'texto'
    const esIdNombre = /^(id|sku|codigo|código|ref|referencia)/i.test(nombre.trim())
    if (noVacios === 0) tipo = 'texto'
    else if (esIdNombre) tipo = 'id'
    else if (nums / noVacios >= 0.8) tipo = 'numerica'
    else if (fechas / noVacios >= 0.8) tipo = 'fecha'
    else if (cardinalidad <= 12 && cardinalidad < noVacios) tipo = 'categorica'
    return { nombre, idx, tipo, cardinalidad, noVacios, vacios }
  })
}

const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

export type KpiGenerica = {
  key: string
  titulo: string
  valor: string
  subtitulo?: string
}

export function inferirKpis(data: Record<string, SheetData>): KpiGenerica[] {
  const kpis: KpiGenerica[] = []
  const entradas = Object.entries(data)

  const porFilas = entradas
    .map(([nombre, sheet]) => ({ nombre, filas: sheet.rows.length }))
    .filter((x) => x.filas > 0)
    .sort((a, b) => b.filas - a.filas)
  for (const { nombre, filas } of porFilas.slice(0, 3)) {
    kpis.push({
      key: `filas-${nombre}`,
      titulo: `Filas en ${nombre}`,
      valor: filas.toLocaleString('es-ES'),
      subtitulo: `${sheetCols(data[nombre])} columnas`,
    })
  }

  for (const [hoja, sheet] of entradas) {
    const cols = analizarColumnas(sheet)
    const numericas = cols.filter((c) => c.tipo === 'numerica')
    for (const col of numericas.slice(0, 2)) {
      let suma = 0
      let count = 0
      for (const fila of sheet.rows) {
        const n = num(fila[col.idx])
        if (Number.isFinite(n)) {
          suma += n
          count++
        }
      }
      if (count > 0) {
        kpis.push({
          key: `suma-${hoja}-${col.nombre}`,
          titulo: `Suma de ${col.nombre}`,
          valor: fmt.format(suma),
          subtitulo: `${hoja} · ${count} valores`,
        })
        kpis.push({
          key: `media-${hoja}-${col.nombre}`,
          titulo: `Media de ${col.nombre}`,
          valor: fmt.format(suma / count),
          subtitulo: `en ${hoja}`,
        })
      }
    }
    const fechas = cols.filter((c) => c.tipo === 'fecha')
    for (const col of fechas.slice(0, 1)) {
      let min: Date | null = null
      let max: Date | null = null
      for (const fila of sheet.rows) {
        const f = parseFecha(fila[col.idx])
        if (!f) continue
        if (!min || f < min) min = f
        if (!max || f > max) max = f
      }
      if (min && max) {
        kpis.push({
          key: `rango-${hoja}-${col.nombre}`,
          titulo: `Rango de ${col.nombre}`,
          valor: `${min.toLocaleDateString('es-ES')} → ${max.toLocaleDateString('es-ES')}`,
          subtitulo: `en ${hoja}`,
        })
      }
    }
  }

  return kpis.slice(0, 8)
}

function sheetCols(sheet: SheetData | undefined): number {
  return sheet?.header.length ?? 0
}

export function inferirGraficos(data: Record<string, SheetData>): Grafico[] {
  const graficos: Grafico[] = []
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

  for (const [hoja, sheet] of Object.entries(data)) {
    const cols = analizarColumnas(sheet)
    const prioritaria = /^(estado|resultado|tipo|categor)/i
    const cats = cols.filter((c) => c.tipo === 'categorica')
    cats.sort((a, b) => Number(prioritaria.test(b.nombre)) - Number(prioritaria.test(a.nombre)))
    for (const col of cats.slice(0, 1)) {
      const grupos = new Map<string, { etiqueta: string; valor: number }>()
      for (const fila of sheet.rows) {
        const crudo = String(fila[col.idx] ?? '').trim()
        if (!crudo) continue
        const clave = norm(crudo)
        const g = grupos.get(clave)
        if (g) g.valor++
        else grupos.set(clave, { etiqueta: crudo, valor: 1 })
      }
      const puntos = [...grupos.values()]
        .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, 'es'))
        .slice(0, 8)
      if (puntos.length >= 2) {
        graficos.push({
          id: `cat-${hoja}-${col.nombre}`,
          titulo: `${col.nombre} por ${hoja}`,
          tipo: puntos.length <= 2 ? 'donut' : 'barras',
          puntos,
        })
      }
    }

    for (const col of cols.filter((c) => c.tipo === 'fecha').slice(0, 1)) {
      const conteo = new Array<number>(12).fill(0)
      let hay = false
      for (const fila of sheet.rows) {
        const f = parseFecha(fila[col.idx])
        if (!f) continue
        conteo[f.getMonth()]++
        hay = true
      }
      if (hay) {
        const puntos = conteo
          .map((valor, mes) => ({ etiqueta: MESES[mes], valor }))
          .filter((p) => p.valor > 0)
        if (puntos.length >= 2) {
          graficos.push({
            id: `fecha-${hoja}-${col.nombre}`,
            titulo: `${col.nombre} por mes`,
            tipo: 'barras',
            puntos,
          })
        }
      }
    }
  }

  return graficos.slice(0, 4)
}

export function alertasGenericas(data: Record<string, SheetData>): Alerta[] {
  const out: Alerta[] = []
  let id = 0

  for (const [hoja, sheet] of Object.entries(data)) {
    const total = sheet.rows.length
    if (total === 0) continue
    const cols = analizarColumnas(sheet)

    for (const col of cols) {
      if (col.noVacios > 0 && col.vacios / total > 0.4 && col.vacios >= 3) {
        out.push({
          id: `vacios-${id++}`,
          tono: 'warn',
          texto: `${col.nombre}: ${col.vacios} de ${total} filas vacías en ${hoja}`,
        })
      }
    }

    const idCols = cols.filter((c) => c.tipo === 'id')
    for (const col of idCols) {
      const vistos = new Map<string, number>()
      let duplicados = 0
      for (const fila of sheet.rows) {
        const k = norm(fila[col.idx])
        if (!k) continue
        const n = (vistos.get(k) ?? 0) + 1
        vistos.set(k, n)
        if (n === 2) duplicados++
      }
      if (duplicados > 0) {
        out.push({
          id: `duplicados-${id++}`,
          tono: 'danger',
          texto: `${duplicados} valores duplicados en ${col.nombre} (${hoja})`,
        })
      }
    }
  }

  if (!out.length) {
    out.push({ id: 'sin-incidencias', tono: 'ok', texto: 'Sin incidencias pendientes' })
  }
  return out.slice(0, 5)
}

export function sugerenciasCopiloto(header: string[], sheetName: string): string[] {
  const base = [
    `Resume la hoja ${sheetName}`,
    `¿Cuántas filas tiene ${sheetName}?`,
  ]
  const numericas = header.filter((h) => /importe|total|precio|coste|salario|cantidad|stock|puntos|suma|valor/i.test(h))
  const fechas = header.filter((h) => /fecha|alta|baja|inicio|fin|dia|día/i.test(h))
  const categoricas = header.filter((h) => /estado|tipo|categoria|categoría|cliente|proveedor|zona|centro|nombre/i.test(h))

  const extra: string[] = []
  if (numericas[0]) extra.push(`¿Cuál es la media de ${numericas[0]}?`)
  if (fechas[0]) extra.push(`¿Qué rango de fechas hay en ${fechas[0]}?`)
  if (categoricas[0]) extra.push(`Distribúyeme ${categoricas[0]}`)
  extra.push('¿Hay datos incompletos?')

  return [...base, ...extra].slice(0, 6)
}
