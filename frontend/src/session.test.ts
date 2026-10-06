import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CLAVE_SESION,
  borrarSesion,
  cargarSesion,
  guardarSesion,
  nuevoToken,
} from './session'
import type { WorkbookFull } from './edit'

const wb: WorkbookFull = {
  id: 'abc',
  filename: 'demo.xlsx',
  uploaded_at: '2026-10-05T00:00:00+00:00',
  hojas: [{ name: 'Ventas', header: ['A'], rows: [['1']] }],
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('sesion local', () => {
  it('guarda, recarga y borra la sesion', () => {
    const ok = guardarSesion({ token: 'tok-1', cambios: 3, wb, guardadoEn: 'ahora' })
    expect(ok).toBe(true)
    const cargada = cargarSesion()
    expect(cargada?.token).toBe('tok-1')
    expect(cargada?.cambios).toBe(3)
    expect(cargada?.wb.hojas[0].rows).toEqual([['1']])
    borrarSesion()
    expect(cargarSesion()).toBeNull()
  })

  it('devuelve null con datos corruptos o sin sesion', () => {
    expect(cargarSesion()).toBeNull()
    sessionStorage.setItem(CLAVE_SESION, '{no-json')
    expect(cargarSesion()).toBeNull()
  })

  it('vive solo en sessionStorage: se borra al cerrar el navegador', () => {
    guardarSesion({ token: 'tok-2', cambios: 1, wb, guardadoEn: 'ahora' })
    expect(sessionStorage.getItem(CLAVE_SESION)).not.toBeNull()
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull()
  })

  it('ignora y limpia una sesion heredada de localStorage', () => {
    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ token: 'viejo', cambios: 9, wb, guardadoEn: 'ayer' }),
    )
    expect(cargarSesion()).toBeNull()
    expect(localStorage.getItem(CLAVE_SESION)).toBeNull()
  })

  it('reporta false si el navegador no tiene espacio', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(guardarSesion({ token: 't', cambios: 1, wb, guardadoEn: 'x' })).toBe(false)
  })

  it('genera tokens unicos', () => {
    expect(nuevoToken()).not.toBe(nuevoToken())
    expect(nuevoToken()).toMatch(/^[0-9a-f-]{36}$/)
  })
})
