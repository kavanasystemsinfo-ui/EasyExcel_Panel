export type Tono = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

export function norm(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function num(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const limpio = value.replace(/\./g, '').replace(',', '.').trim()
    if (!limpio) return NaN
    const n = Number(limpio)
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

export function parseFecha(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const corta = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (corta) {
    return new Date(Number(corta[3]), Number(corta[2]) - 1, Number(corta[1]))
  }
  const iso = new Date(value)
  return Number.isNaN(iso.getTime()) ? null : iso
}

export function formatMoneda(value: unknown): string {
  const n = num(value)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace(/\u00A0/g, ' ')
}

export function formatFecha(value: unknown): string {
  const fecha = parseFecha(value)
  if (!fecha) return ''
  const dia = String(fecha.getDate()).padStart(2, '0')
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${fecha.getFullYear()}`
}

export function tonoEstado(value: unknown): Tono {
  const texto = norm(value)
  if (!texto) return 'neutral'
  if (
    texto.includes('no conforme') ||
    texto.startsWith('baja') ||
    texto.includes('vencid') ||
    texto.includes('rechazad') ||
    texto.includes('incidencia')
  ) {
    return 'danger'
  }
  if (
    texto.includes('vacacion') ||
    texto.includes('disfrut') ||
    texto.includes('en tramite') ||
    texto.includes('tramitad')
  ) {
    return 'info'
  }
  if (
    texto.includes('pendiente') ||
    texto.includes('mantenimiento') ||
    texto.includes('abiert') ||
    texto.includes('correctiva') ||
    texto.includes('solicitad') ||
    texto.includes('proximo')
  ) {
    return 'warn'
  }
  if (
    texto === 'activo' ||
    texto === 'conforme' ||
    texto === 'operativa' ||
    texto === 'aprobada' ||
    texto === 'cerrada'
  ) {
    return 'ok'
  }
  return 'neutral'
}

const RE_FEHAS = /(fecha|alta|baja|inicio|fin|solicitud|revision|garantia|cierre|compra|vencimiento)/
const RE_DINERO = /(salario|importe|coste|precio|plus|puntuacion)/

export function formatCelda(header: string, value: unknown): string {
  const nombre = norm(header)
  if (RE_FEHAS.test(nombre) && typeof value === 'string' && value) {
    const fecha = formatFecha(value)
    if (fecha) return fecha
  }
  if (RE_DINERO.test(nombre) && typeof value !== 'boolean') {
    const texto = formatMoneda(value)
    if (texto) return texto
  }
  if (value === null || value === undefined) return ''
  return String(value)
}

export function esColumnaEstado(header: string): boolean {
  const nombre = norm(header)
  return nombre === 'estado' || nombre === 'resultado'
}

export function esColumnaId(header: string): boolean {
  return norm(header) === 'id'
}

export function esColumnaNombre(header: string): boolean {
  return norm(header).includes('nombre')
}
