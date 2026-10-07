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
  localStorage.clear()
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

describe('App con demo automatica (Fase 3)', () => {
  const manifestDemo = {
    id: 'd3e0demo000000000000000000000000',
    filename: 'easyexcel_demo.xlsx',
    uploaded_at: '2026-10-05T00:00:00+00:00',
    sheets: [{ name: 'Ventas', rows: 2, cols: 2 }],
  }

  function mockDemo() {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('/sheets/Ventas/rows')) {
        return Promise.resolve(jsonResponse(sheetRows))
      }
      if (href.endsWith('/workbooks/demo')) {
        return Promise.resolve(jsonResponse(manifestDemo))
      }
      return Promise.resolve(jsonResponse({ detail: 'no mockeado' }, 404))
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('carga el demo al entrar sin subir nada, en la vista Resumen', async () => {
    const fetchMock = mockDemo()
    render(<App />)
    await waitFor(() => expect(screen.getByText(/Sesión local/)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/workbooks/demo', undefined)
    expect(screen.queryByTestId('upload-zone')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alertas del día' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
  })

  it('navega a la seccion Datos y ahi aparece el grid', async () => {
    mockDemo()
    render(<App />)
    await waitFor(() => expect(screen.getByText(/Sesión local/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Datos' }))
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: 'Producto' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Datos' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('tab', { name: /Ventas/ })).toBeInTheDocument()
  })

  it('la subida de un archivo propio aterriza en la vista Datos', async () => {
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
    expect(screen.queryByRole('heading', { name: 'Alertas del día' })).not.toBeInTheDocument()
  })

  it('restablecer recarga el demo desde el servidor', async () => {
    const fetchMock = mockDemo()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    await waitFor(() => expect(screen.getByText(/Sesión local/)).toBeInTheDocument())
    const demoCalls = () =>
      fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/workbooks/demo')).length
    expect(demoCalls()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: /restablecer/i }))
    await waitFor(() => expect(demoCalls()).toBe(2))
    fireEvent.click(screen.getByRole('button', { name: 'Datos' }))
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: 'Producto' })).toBeInTheDocument(),
    )
  })
})

describe('Asistente IA (Fase 6)', () => {
  it('vive en la parte superior y se oculta y reabre desde su cabecera', async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('/sheets/Ventas/rows')) {
        return Promise.resolve(jsonResponse(sheetRows))
      }
      if (href.endsWith('/workbooks/demo')) {
        return Promise.resolve(
          jsonResponse({
            id: 'd3e0demo000000000000000000000000',
            filename: 'easyexcel_demo.xlsx',
            uploaded_at: '2026-10-05T00:00:00+00:00',
            sheets: [{ name: 'Ventas', rows: 2, cols: 2 }],
          }),
        )
      }
      return Promise.resolve(jsonResponse({ detail: 'no mockeado' }, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Sesión local/)).toBeInTheDocument())

    // el topbar ya no lleva su propio boton de asistente
    expect(document.querySelector('.topbar')?.textContent).not.toMatch(/Asistente IA/)

    // visible arriba: tras el banner y antes de los paneles inferiores
    const contenido = document.querySelector('.app-content')
    const copiloto = document.querySelector('.copilot')
    const banner = document.querySelector('.banner')
    const paneles = document.querySelector('.bottom-panels')
    if (!contenido || !copiloto || !banner || !paneles) {
      throw new Error('faltan nodos del layout')
    }
    const hijos = Array.from(contenido.children)
    expect(hijos.indexOf(copiloto)).toBeGreaterThan(hijos.indexOf(banner))
    expect(hijos.indexOf(copiloto)).toBeLessThan(hijos.indexOf(paneles))
    expect(copiloto.closest('.bottom-panels')).toBeNull()

    // se oculta con su cabecera y el panel deja de ocupar sitio
    const cabecera = screen.getByRole('button', { name: /asistente ia/i })
    expect(cabecera).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/pregunta al copiloto/i)).toBeInTheDocument()
    fireEvent.click(cabecera)
    expect(cabecera).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/pregunta al copiloto/i)).not.toBeInTheDocument()
    expect(localStorage.getItem('easyexcel-copiloto')).toBe('cerrado')

    // y se reabre desde la misma cabecera, con la eleccion persistida
    fireEvent.click(cabecera)
    expect(cabecera).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/pregunta al copiloto/i)).toBeInTheDocument()
    expect(localStorage.getItem('easyexcel-copiloto')).toBe('abierto')
  })
})


