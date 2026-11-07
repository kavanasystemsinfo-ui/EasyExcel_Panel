import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SheetSelector from './SheetSelector'

const hojas = [
  { name: 'Uno', rows: 3, cols: 2, header_row: 1, truncada: null },
  { name: 'Dos', rows: 4, cols: 2, header_row: 1, truncada: null, aviso: 'Aviso de prueba' },
  { name: 'Tres', rows: 5, cols: 2, header_row: 1, truncada: null },
] as const

describe('SheetSelector', () => {
  it('muestra el aviso de la hoja', () => {
    render(<SheetSelector sheets={[...hojas]} active="Uno" onSelect={vi.fn()} />)
    expect(screen.getByRole('note', { name: 'Aviso de prueba' })).toBeTruthy()
  })

  it('se mueve entre pestañas con las flechas, Inicio y Fin', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <SheetSelector sheets={[...hojas]} active="Uno" onSelect={onSelect} />,
    )
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenLastCalledWith('Dos')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
    expect(onSelect).toHaveBeenLastCalledWith('Tres')
    rerender(<SheetSelector sheets={[...hojas]} active="Tres" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenLastCalledWith('Dos')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Home' })
    expect(onSelect).toHaveBeenLastCalledWith('Uno')
  })

  it('solo la pestaña activa entra en el orden de tabulación', () => {
    render(<SheetSelector sheets={[...hojas]} active="Dos" onSelect={vi.fn()} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
  })
})
