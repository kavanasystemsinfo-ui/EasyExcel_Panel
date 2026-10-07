import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Toolbar from './Toolbar'

const base = {
  header: ['Nombre', 'Estado'],
  mostrarChipActivos: true,
  soloActivos: false,
  onSoloActivos: vi.fn(),
  ocultas: [],
  onToggleCol: vi.fn(),
  coincidencias: null as number | null,
  onAddRow: vi.fn(),
  onAddCol: vi.fn(),
  onExportExcel: vi.fn(),
  onExportPdf: vi.fn(),
}

describe('Toolbar', () => {
  it('el boton Nueva columna no muestra texto raro del icono', () => {
    render(<Toolbar {...base} query="" onQuery={vi.fn()} />)
    const boton = screen.getByRole('button', { name: /nueva columna/i })
    expect(boton.textContent).toContain('Nueva columna')
    expect(boton.textContent).not.toContain('COLUMN')
    expect(boton.textContent).not.toContain('+')
  })

  it('el boton F abre un campo para buscar cualquier dato a mano', () => {
    const onQuery = vi.fn()
    render(<Toolbar {...base} query="" onQuery={onQuery} />)
    fireEvent.click(screen.getByRole('button', { name: /buscar dato/i }))
    const input = screen.getByPlaceholderText(/buscar cualquier dato/i)
    fireEvent.change(input, { target: { value: 'sara' } })
    expect(onQuery).toHaveBeenCalledWith('sara')
  })

  it('con query activa el campo se muestra sin pulsar F y la F queda activa', () => {
    render(<Toolbar {...base} query="emp001" onQuery={vi.fn()} />)
    const input = screen.getByPlaceholderText(/buscar cualquier dato/i) as HTMLInputElement
    expect(input.value).toBe('emp001')
    const boton = screen.getByRole('button', { name: /buscar dato/i })
    expect(boton).toHaveAttribute('aria-pressed', 'true')
  })

  it('el boton con query limpia la busqueda y cierra el campo', () => {
    const onQuery = vi.fn()
    render(<Toolbar {...base} query="sara" onQuery={onQuery} />)
    fireEvent.click(screen.getByRole('button', { name: /buscar dato/i }))
    expect(onQuery).toHaveBeenCalledWith('')
  })
})
