import { norm, num, parseFecha } from './cells'

export type SheetData = { header: string[]; rows: unknown[][] }

export type PlantillaKpi = {
  activos: number
  total: number
  completas: number
  parciales: number
  bajas: number
}

export type CentrosKpi = { activos: number; total: number; vigentes: number; historicas: number }

export type TurnosKpi = {
  manana: number
  tarde: number
  noche: number
  rotativo: number
  otros: number
  conPlusNoche: number
}

export type VacacionesKpi = {
  hoy: number
  pendientes: number
  maxDias: number
  cumple30: boolean
}

export type MaquinariaKpi = {
  operativas: number
  total: number
  pct: number
  vencidas: number
  proximas30: number
}

export type CalidadKpi = { media: number; total: number; conformes: number }

export type CoberturaCentro = { nombre: string; activos: number; plantilla: number }

export type Kpis = {
  plantilla?: PlantillaKpi
  centros?: CentrosKpi
  turnos?: TurnosKpi
  vacaciones?: VacacionesKpi
  maquinaria?: MaquinariaKpi
  calidad?: CalidadKpi
  cobertura?: CoberturaCentro[]
}

function indice(header: string[], ...candidatos: string[]): number {
  const normalizado = header.map(norm)
  for (const candidato of candidatos) {
    const exacto = normalizado.indexOf(norm(candidato))
    if (exacto >= 0) return exacto
  }
  for (const candidato of candidatos) {
    const parcial = normalizado.findIndex((col) => col.includes(norm(candidato)))
    if (parcial >= 0) return parcial
  }
  return -1
}

function valor(fila: unknown[], i: number): unknown {
  return i >= 0 ? fila[i] : ''
}

function esActivo(fila: unknown[], iEstado: number): boolean {
  return norm(valor(fila, iEstado)) === 'activo'
}

function contarPlantilla(empleados: SheetData): PlantillaKpi {
  const iEstado = indice(empleados.header, 'Estado')
  const iJornada = indice(empleados.header, 'Jornada')
  let activos = 0
  let completas = 0
  let parciales = 0
  let bajas = 0
  for (const fila of empleados.rows) {
    const estado = norm(valor(fila, iEstado))
    if (estado === 'activo') activos++
    if (estado.includes('baja')) bajas++
    const jornada = norm(valor(fila, iJornada))
    if (jornada === 'completa') completas++
    else if (jornada === 'parcial') parciales++
  }
  return { activos, total: empleados.rows.length, completas, parciales, bajas }
}

function contarTurnos(empleados: SheetData): TurnosKpi {
  const iEstado = indice(empleados.header, 'Estado')
  const iTurno = indice(empleados.header, 'Turno Habitual', 'Turno')
  const iPlus = indice(empleados.header, 'Plus Nocturnidad')
  const kpi: TurnosKpi = {
    manana: 0,
    tarde: 0,
    noche: 0,
    rotativo: 0,
    otros: 0,
    conPlusNoche: 0,
  }
  for (const fila of empleados.rows) {
    if (!esActivo(fila, iEstado)) continue
    const turno = norm(valor(fila, iTurno))
    if (/man|mat/.test(turno)) kpi.manana++
    else if (turno.includes('tar')) kpi.tarde++
    else if (turno.includes('noc')) kpi.noche++
    else if (turno.includes('rot')) kpi.rotativo++
    else if (turno) kpi.otros++
    if (num(valor(fila, iPlus)) > 0) kpi.conPlusNoche++
  }
  return kpi
}

function contarCentros(centros: SheetData, asignaciones?: SheetData): CentrosKpi {
  const iEstado = indice(centros.header, 'Estado')
  let activos = 0
  for (const fila of centros.rows) {
    if (norm(valor(fila, iEstado)) === 'activo') activos++
  }
  let vigentes = 0
  let historicas = 0
  if (asignaciones) {
    const iFin = indice(asignaciones.header, 'Fecha Fin')
    historicas = asignaciones.rows.length
    for (const fila of asignaciones.rows) {
      if (!String(valor(fila, iFin) ?? '').trim()) vigentes++
    }
  }
  return { activos, total: centros.rows.length, vigentes, historicas }
}

function contarVacaciones(vacaciones: SheetData, hoy: Date): VacacionesKpi {
  const iInicio = indice(vacaciones.header, 'Fecha Inicio')
  const iFin = indice(vacaciones.header, 'Fecha Fin')
  const iEstado = indice(vacaciones.header, 'Estado')
  const iDias = indice(vacaciones.header, 'Dias Naturales', 'Dias')
  const finHoy = hoy.getTime()
  let enDisfrute = 0
  let pendientes = 0
  let maxDias = 0
  for (const fila of vacaciones.rows) {
    const inicio = parseFecha(valor(fila, iInicio))
    const fin = parseFecha(valor(fila, iFin))
    const estado = norm(valor(fila, iEstado))
    if (inicio && fin && inicio.getTime() <= finHoy && finHoy <= fin.getTime()) {
      if (!estado.includes('rechaz')) enDisfrute++
    }
    if (estado.includes('pendiente') || estado.includes('solicitad')) pendientes++
    const dias = num(valor(fila, iDias))
    if (Number.isFinite(dias)) maxDias = Math.max(maxDias, dias)
  }
  return { hoy: enDisfrute, pendientes, maxDias, cumple30: maxDias <= 30 }
}

function contarMaquinaria(maquinaria: SheetData, hoy: Date): MaquinariaKpi {
  const iEstado = indice(maquinaria.header, 'Estado')
  const iRevision = indice(maquinaria.header, 'Proxima Revision', 'Proxima Revisión')
  const inicio = hoy.getTime()
  const en30 = inicio + 30 * 24 * 60 * 60 * 1000
  let operativas = 0
  let vencidas = 0
  let proximas30 = 0
  for (const fila of maquinaria.rows) {
    if (norm(valor(fila, iEstado)).includes('operativ')) operativas++
    const revision = parseFecha(valor(fila, iRevision))
    if (!revision) continue
    const t = revision.getTime()
    if (t < inicio) vencidas++
    else if (t <= en30) proximas30++
  }
  const total = maquinaria.rows.length
  return {
    operativas,
    total,
    pct: total ? Math.round((operativas / total) * 100) : 0,
    vencidas,
    proximas30,
  }
}

function contarCalidad(auditorias: SheetData): CalidadKpi {
  const iPuntuacion = indice(auditorias.header, 'Puntuacion', 'Puntuación')
  const iResultado = indice(auditorias.header, 'Resultado')
  let suma = 0
  let cantidad = 0
  let conformes = 0
  for (const fila of auditorias.rows) {
    const puntuacion = num(valor(fila, iPuntuacion))
    if (Number.isFinite(puntuacion)) {
      suma += puntuacion
      cantidad++
    }
    if (norm(valor(fila, iResultado)) === 'conforme') conformes++
  }
  return {
    media: cantidad ? Math.round(suma / cantidad) : 0,
    total: auditorias.rows.length,
    conformes,
  }
}

function calcularCobertura(
  empleados: SheetData,
  centros: SheetData,
): CoberturaCentro[] {
  const iCentroEmpleados = indice(empleados.header, 'Centro Coste', 'Centro')
  const iEstado = indice(empleados.header, 'Estado')
  const iId = indice(centros.header, 'ID Centro', 'ID')
  const iNombre = indice(centros.header, 'Nombre')
  const iPlantilla = indice(centros.header, 'Plantilla Asignada', 'Plantilla')
  return centros.rows.map((fila) => {
    const id = norm(valor(fila, iId))
    const activos = empleados.rows.filter(
      (empleado) =>
        esActivo(empleado, iEstado) &&
        norm(valor(empleado, iCentroEmpleados)) === id,
    ).length
    const plantilla = num(valor(fila, iPlantilla))
    return {
      nombre: String(valor(fila, iNombre) ?? id),
      activos,
      plantilla: Number.isFinite(plantilla) ? plantilla : 0,
    }
  })
}

export function calcularKpis(
  sheets: Record<string, SheetData>,
  hoy: Date,
): Kpis {
  const kpis: Kpis = {}
  const empleados = sheets['Empleados']
  const centros = sheets['Centros']
  const asignaciones = sheets['Asignaciones']

  if (empleados) {
    kpis.plantilla = contarPlantilla(empleados)
    kpis.turnos = contarTurnos(empleados)
  }
  if (centros) {
    kpis.centros = contarCentros(centros, asignaciones)
    if (empleados) kpis.cobertura = calcularCobertura(empleados, centros)
  }
  if (sheets['Vacaciones']) {
    kpis.vacaciones = contarVacaciones(sheets['Vacaciones'], hoy)
  }
  if (sheets['Maquinaria']) {
    kpis.maquinaria = contarMaquinaria(sheets['Maquinaria'], hoy)
  }
  if (sheets['Auditorias']) {
    kpis.calidad = contarCalidad(sheets['Auditorias'])
  }
  return kpis
}
