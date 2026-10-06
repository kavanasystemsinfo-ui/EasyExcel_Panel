import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ExportMenu from './ExportMenu'

describe('ExportMenu', () => {
  it('ofrece Excel y PDF al abrir el menu', () => {
    render(<ExportMenu modo="btn" excel onExcel={vi.fn()} onPdf={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    expect(screen.getByRole('menuitem', { name: /excel/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /pdf/i })).toBeTruthy()
  })

  it('ejecuta la descarga de Excel', () => {
    const onExcel = vi.fn().mockResolvedValue(undefined)
    render(<ExportMenu modo="btn" excel onExcel={onExcel} onPdf={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /excel/i }))
    expect(onExcel).toHaveBeenCalledTimes(1)
  })

  it('ejecuta la impresion de PDF', () => {
    const onPdf = vi.fn()
    render(<ExportMenu modo="btn" excel onExcel={vi.fn()} onPdf={onPdf} />)
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /pdf/i }))
    expect(onPdf).toHaveBeenCalledTimes(1)
  })

  it('deshabilita Excel cuando no hay tabla', () => {
    const onExcel = vi.fn()
    render(<ExportMenu modo="btn" excel={false} onExcel={onExcel} onPdf={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    const item = screen.getByRole('menuitem', { name: /excel/i }) as HTMLButtonElement
    expect(item.disabled).toBe(true)
    fireEvent.click(item)
    expect(onExcel).not.toHaveBeenCalled()
  })

  it('muestra estado ocupado mientras genera', async () => {
    let resolve: () => void = () => {}
    const onExcel = vi.fn(
      () => new Promise<void>((r) => {
        resolve = r
      }),
    )
    render(<ExportMenu modo="btn" excel onExcel={onExcel} onPdf={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /excel/i }))
    expect(screen.getByRole('menuitem', { name: /generando/i })).toBeTruthy()
    resolve()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('renderiza como chip en la barra de herramientas', () => {
    render(<ExportMenu modo="chip" excel onExcel={vi.fn()} onPdf={vi.fn()} />)
    expect(document.querySelector('.chip')).toBeTruthy()
  })
})
