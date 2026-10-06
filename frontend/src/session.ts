import type { WorkbookFull } from './edit'

export const CLAVE_SESION = 'easyexcel:sesion:v1'

export type Sesion = {
  token: string
  cambios: number
  wb: WorkbookFull
  guardadoEn: string
}

export function nuevoToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function cargarSesion(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE_SESION)
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
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    return true
  } catch {
    return false
  }
}

export function borrarSesion(): void {
  try {
    localStorage.removeItem(CLAVE_SESION)
  } catch {
    // localStorage no disponible: no hay nada que borrar
  }
}
