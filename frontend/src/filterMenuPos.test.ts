import { describe, expect, it } from 'vitest'
import { calcularPosMenu } from './filterMenuPos'

describe('calcularPosMenu', () => {
  const vp = { alto: 800, ancho: 1400 }

  it('abre hacia abajo cuando el menu cabe en el viewport', () => {
    const pos = calcularPosMenu(
      { top: 200, bottom: 230, left: 300 },
      420,
      vp.alto,
      vp.ancho,
    )
    expect(pos).toEqual({ top: 236, left: 300 })
  })

  it('abre hacia arriba cuando el menu no cabe por abajo', () => {
    const pos = calcularPosMenu(
      { top: 600, bottom: 630, left: 300 },
      420,
      vp.alto,
      vp.ancho,
    )
    expect(pos.top).toBe(600 - 6 - 420)
    expect(pos.left).toBe(300)
  })

  it('nunca coloca el menu fuera del viewport aunque no quepa ni arriba', () => {
    const pos = calcularPosMenu(
      { top: 20, bottom: 50, left: 300 },
      700,
      vp.alto,
      vp.ancho,
    )
    expect(pos.top).toBeGreaterThanOrEqual(8)
  })

  it('recorta el left cuando el menu se saldria por la derecha', () => {
    const pos = calcularPosMenu(
      { top: 100, bottom: 130, left: 1250 },
      300,
      vp.alto,
      vp.ancho,
    )
    expect(pos.left).toBe(1400 - 320 - 8)
  })
})
