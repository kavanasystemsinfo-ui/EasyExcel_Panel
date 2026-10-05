import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const workbook = {
  id: 'abc123',
  filename: 'demo.xlsx',
  uploaded_at: '2026-10-05T00:00:00+00:00',
  sheets: [{ name: 'Ventas', rows: 2, cols: 2 }],
}

const sheetRows = {
  sheet: 'Ventas',
  header: ['Producto', 'Unidades'],
  rows: [
    ['Sofa', 3],
    ['Mesa', 1],
  ],
  total: 2,
  offset: 0,
  limit: 100,
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('muestra la zona de carga al arrancar', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'EasyExcel Panel' })).toBeInTheDocument()
    expect(screen.getByTestId('upload-zone')).toBeInTheDocument()
  })

  it('sube un archivo, carga la hoja y muestra el grid', async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)
      if (href.endsWith('/api/v1/workbooks') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(workbook, 201))
      }
      if (href.includes('/sheets/Ventas/rows')) {
        return Promise.resolve(jsonResponse(sheetRows))
      }
      return Promise.resolve(jsonResponse({ detail: 'no mockeado' }, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    const input = screen.getByLabelText(/archivo excel/i)
    const file = new File(['x'], 'demo.xlsx', { type: 'application/octet-stream' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: 'Producto' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('cell', { name: 'Sofa' })).toBeInTheDocument()
    expect(screen.getByText('demo.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Ventas/ })).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ detail: 'El archivo supera 10 MB' }, 413))),
    )

    render(<App />)
    const input = screen.getByLabelText(/archivo excel/i)
    const file = new File(['x'], 'demo.xlsx', { type: 'application/octet-stream' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('El archivo supera 10 MB'),
    )
  })
})

