import type { WorkbookFull } from './edit'
import type { Filtro } from './filters'
import type { Seccion } from './views'

export const CLAVE_SESION = 'easyexcel:sesion:v1'

export type Vista = {
  seccion?: Seccion
  hoja: string | null
  query: string
  soloActivos: boolean
  ocultas: number[]
  filtros: Filtro[]
  pagina: number
}

export type Sesion = {
  token: string
  cambios: number
  wb: WorkbookFull
  guardadoEn: string
  vista?: Vista
}

export function nuevoToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function cargarSesion(): Sesion | null {
  try {
    localStorage.removeItem(CLAVE_SESION)
    const crudo = sessionStorage.getItem(CLAVE_SESION)
    if (!crudo) return null
    const datos = JSON.parse(crudo) as Sesion
    if (!datos?.token || !datos?.wb?.hojas) return null
    return datos
  } catch {
    return null
  }
}

export function guardarSesion(sesion: Sesion): boolean {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    return true
  } catch {
    return false
  }
}

export function borrarSesion(): void {
  try {
    sessionStorage.removeItem(CLAVE_SESION)
  } catch {
    // sessionStorage no disponible: no hay nada que borrar
  }
}
