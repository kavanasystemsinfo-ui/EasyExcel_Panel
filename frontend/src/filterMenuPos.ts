export type RectMenu = { top: number; bottom: number; left: number }

export function calcularPosMenu(
  rect: RectMenu,
  altoMenu: number,
  altoViewport: number,
  anchoViewport: number,
): { top: number; left: number } {
  const MARGEN = 8
  const ANCHO_MENU = 320
  const topAbajo = rect.bottom + 6
  const cabeAbajo = topAbajo + altoMenu + MARGEN <= altoViewport
  const top = cabeAbajo
    ? topAbajo
    : Math.max(MARGEN, rect.top - 6 - altoMenu)
  const left = Math.min(
    rect.left,
    Math.max(MARGEN, anchoViewport - ANCHO_MENU - MARGEN),
  )
  return { top, left }
}
