import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import UploadZone from './UploadZone'

function makeFile(name: string): File {
  return new File(['data'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('UploadZone', () => {
  it('permite seleccionar un .xlsx y avisa al padre', () => {
    const onFile = vi.fn()
    render(<UploadZone onFile={onFile} busy={false} error={null} />)
    const input = screen.getByLabelText(/archivo excel/i)
    fireEvent.change(input, { target: { files: [makeFile('demo.xlsx')] } })
    expect(onFile).toHaveBeenCalledWith(expect.any(File))
  })

  it('rechaza en cliente archivos que no son .xlsx', () => {
    const onFile = vi.fn()
    render(<UploadZone onFile={onFile} busy={false} error={null} />)
    const input = screen.getByLabelText(/archivo excel/i)
    fireEvent.change(input, { target: { files: [makeFile('datos.xls')] } })
    expect(onFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/\.xlsx/i)
  })

  it('procesa el arrastre sobre la zona', () => {
    const onFile = vi.fn()
    render(<UploadZone onFile={onFile} busy={false} error={null} />)
    const zone = screen.getByTestId('upload-zone')
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile('drag.xlsx')] } })
    expect(onFile).toHaveBeenCalledWith(expect.any(File))
  })

  it('muestra el error del servidor', () => {
    render(
      <UploadZone onFile={() => {}} busy={false} error="El archivo supera 10 MB" />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('El archivo supera 10 MB')
  })

  it('deshabilita la zona mientras hay una carga en curso', () => {
    render(<UploadZone onFile={() => {}} busy={true} error={null} />)
    const input = screen.getByLabelText(/archivo excel/i) as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })
})

