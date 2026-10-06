import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GridView from './GridView'

const header = ['Producto', 'Unidades']
const rows: unknown[][] = [
  ['Sofa', 3],
  ['Mesa', 1],
]

describe('GridView', () => {
  it('renderiza cabecera y filas', () => {
    render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={3}
        offset={0}
        limit={2}
        onPage={vi.fn()}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'Producto' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Sofa' })).toBeInTheDocument()
    expect(screen.getByText(/de 3/i)).toBeInTheDocument()
  })

  it('avanza de pagina y retrocede', () => {
    const onPage = vi.fn()
    const { rerender } = render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={300}
        offset={0}
        limit={100}
        onPage={onPage}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onPage).toHaveBeenCalledWith(100)

    rerender(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={300}
        offset={100}
        limit={100}
        onPage={onPage}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
    expect(onPage).toHaveBeenCalledWith(0)
    expect(screen.getByRole('button', { name: /anterior/i })).toBeEnabled()
  })

  it('deshabilita los limites del paginador', () => {
    render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={3}
        offset={0}
        limit={100}
        onPage={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled()
  })

  it('explica el footer cuando hay filtro activo', () => {
    render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={215}
        offset={100}
        limit={100}
        onPage={vi.fn()}
        filtered
      />,
    )
    expect(
      screen.getByText('2 de 215 filas en la página 2 (filtro activo)'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
  })
})

describe('GridView editable', () => {
  it('edita una celda con doble clic y Enter', () => {
    const onEdit = vi.fn()
    render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={2}
        offset={0}
        limit={100}
        onPage={vi.fn()}
        onEdit={onEdit}
      />,
    )
    fireEvent.dblClick(screen.getByRole('cell', { name: 'Sofa' }))
    const input = screen.getByDisplayValue('Sofa')
    fireEvent.change(input, { target: { value: 'Sofa raso' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onEdit).toHaveBeenCalledWith(0, 0, 'Sofa raso')
  })

  it('usa el indice global de fila al editar', () => {
    const onEdit = vi.fn()
    render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={300}
        offset={100}
        limit={100}
        onPage={vi.fn()}
        onEdit={onEdit}
      />,
    )
    fireEvent.dblClick(screen.getByRole('cell', { name: 'Mesa' }))
    const input = screen.getByDisplayValue('Mesa')
    fireEvent.change(input, { target: { value: 'Mesa de madera' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onEdit).toHaveBeenCalledWith(101, 0, 'Mesa de madera')
  })

  it('cancela la edicion con Escape', () => {
    const onEdit = vi.fn()
    render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={2}
        offset={0}
        limit={100}
        onPage={vi.fn()}
        onEdit={onEdit}
      />,
    )
    fireEvent.dblClick(screen.getByRole('cell', { name: 'Sofa' }))
    const input = screen.getByDisplayValue('Sofa')
    fireEvent.change(input, { target: { value: 'nada' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('nada')).not.toBeInTheDocument()
  })

  it('no es editable sin onEdit', () => {
    render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={2}
        offset={0}
        limit={100}
        onPage={vi.fn()}
      />,
    )
    fireEvent.dblClick(screen.getByRole('cell', { name: 'Sofa' }))
    expect(screen.queryByDisplayValue('Sofa')).not.toBeInTheDocument()
  })

  it('pide eliminar la fila', () => {
    const onDeleteRow = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <GridView
        sheetName="Ventas"
        header={header}
        rows={rows}
        total={2}
        offset={0}
        limit={100}
        onPage={vi.fn()}
        onDeleteRow={onDeleteRow}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar fila' })[0])
    expect(onDeleteRow).toHaveBeenCalledWith(0)
  })
})
