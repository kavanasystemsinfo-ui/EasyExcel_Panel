import { describe, expect, it } from 'vitest'
import {
  anadirColumna,
  anadirFila,
  borrarColumna,
  borrarFila,
  editarCelda,
  hojaDe,
  MAX_COLS,
  renombrarColumna,
  type WorkbookFull,
} from './edit'

function wbBase(): WorkbookFull {
  return {
    id: 'abc',
    filename: 'demo.xlsx',
    uploaded_at: '2026-10-05T00:00:00+00:00',
    hojas: [
      {
        name: 'Ventas',
        header: ['Producto', 'Unidades'],
        rows: [
          ['Sofa', 3],
          ['Mesa', 1],
        ],
      },
    ],
  }
}

describe('editarCelda', () => {
  it('cambia el valor sin tocar el resto ni mutar el original', () => {
    const original = wbBase()
    const next = editarCelda(original, 'Ventas', 0, 1, 99)
    expect(next.hojas[0].rows[0]).toEqual(['Sofa', 99])
    expect(next.hojas[0].rows[1]).toEqual(['Mesa', 1])
    expect(original.hojas[0].rows[0][1]).toBe(3)
  })

  it('rechaza indices fuera de rango', () => {
    const wb = wbBase()
    expect(() => editarCelda(wb, 'Ventas', 5, 0, 'x')).toThrow()
    expect(() => editarCelda(wb, 'Ventas', 0, 9, 'x')).toThrow()
    expect(() => editarCelda(wb, 'Nope', 0, 0, 'x')).toThrow()
  })
})

describe('anadirColumna', () => {
  it('añade cabecera y celda vacia en todas las filas', () => {
    const next = anadirColumna(wbBase(), 'Ventas', 'Estado')
    expect(next.hojas[0].header).toEqual(['Producto', 'Unidades', 'Estado'])
    expect(next.hojas[0].rows[0]).toEqual(['Sofa', 3, ''])
    expect(next.hojas[0].rows[1]).toEqual(['Mesa', 1, ''])
  })

  it('rechaza nombres vacios y duplicados', () => {
    const wb = wbBase()
    expect(() => anadirColumna(wb, 'Ventas', '  ')).toThrow()
    expect(() => anadirColumna(wb, 'Ventas', 'producto')).toThrow()
    expect(() => anadirColumna(wb, 'Ventas', 'NOMBRE nuevo')).not.toThrow()
  })

  it('respeta el limite de columnas', () => {
    const wb = wbBase()
    wb.hojas[0].header = Array.from({ length: MAX_COLS }, (_, i) => `c${i}`)
    wb.hojas[0].rows = [['x']]
    expect(() => anadirColumna(wb, 'Ventas', 'nueva')).toThrow(/200/)
  })
})

describe('anadirFila', () => {
  it('añade una fila con el ancho de la cabecera', () => {
    const next = anadirFila(wbBase(), 'Ventas')
    expect(next.hojas[0].rows).toHaveLength(3)
    expect(next.hojas[0].rows[2]).toEqual(['', ''])
  })

  it('acepta valores iniciales', () => {
    const next = anadirFila(wbBase(), 'Ventas', ['Lámpara', 5])
    expect(next.hojas[0].rows[2]).toEqual(['Lámpara', 5])
  })
})

describe('borrarFila', () => {
  it('elimina la fila pedida', () => {
    const next = borrarFila(wbBase(), 'Ventas', 0)
    expect(next.hojas[0].rows).toEqual([['Mesa', 1]])
  })

  it('rechaza indices invalidos', () => {
    const wb = wbBase()
    expect(() => borrarFila(wb, 'Ventas', 9)).toThrow()
  })
})

describe('borrarColumna', () => {
  it('elimina cabecera y valores de esa posicion', () => {
    const next = borrarColumna(wbBase(), 'Ventas', 0)
    expect(next.hojas[0].header).toEqual(['Unidades'])
    expect(next.hojas[0].rows).toEqual([[3], [1]])
  })
})

describe('renombrarColumna', () => {
  it('cambia el nombre validando duplicados', () => {
    const next = renombrarColumna(wbBase(), 'Ventas', 0, 'Artículo')
    expect(next.hojas[0].header[0]).toBe('Artículo')
    expect(() => renombrarColumna(wbBase(), 'Ventas', 0, 'unidades')).toThrow()
  })
})

describe('hojaDe', () => {
  it('encuentra la hoja o lanza', () => {
    expect(hojaDe(wbBase(), 'Ventas').name).toBe('Ventas')
    expect(() => hojaDe(wbBase(), 'Otra')).toThrow()
  })
})

describe('a partir de un workbook con varias hojas', () => {
  it('solo afecta a la hoja indicada', () => {
    const wb = wbBase()
    wb.hojas.push({ name: 'Otra', header: ['A'], rows: [['1']] })
    const next = borrarFila(wb, 'Ventas', 0)
    expect(next.hojas[0].rows).toHaveLength(1)
    expect(next.hojas[1].rows).toEqual([['1']])
  })
})
