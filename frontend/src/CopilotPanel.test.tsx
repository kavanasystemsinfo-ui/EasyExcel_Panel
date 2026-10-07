import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CopilotPanel from './CopilotPanel'

const contexto = { hoja: 'Empleados', kpis: { total: 215 } }

function sseResponse(eventos: unknown[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const evento of eventos) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CopilotPanel', () => {
  it('tiene el input habilitado y el aviso de privacidad', () => {
    render(<CopilotPanel contexto={contexto} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i) as HTMLInputElement
    expect(input.disabled).toBe(false)
    expect(screen.getByText(/información personal/i)).toBeInTheDocument()
  })

  it('envia la pregunta y pinta la respuesta en streaming', async () => {
    const fetchMock = vi.fn(
      (_url: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(
          sseResponse([
            { t: 'delta', c: 'Hay 215 ' },
            { t: 'delta', c: 'empleados.' },
            { t: 'fin', proveedor: 'openrouter', modelo: 'ling', cache: false },
          ]),
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<CopilotPanel contexto={contexto} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i)
    fireEvent.change(input, { target: { value: '¿Cuántos empleados hay?' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText(/Hay 215 empleados\./)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const llamada = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(llamada[1].body)) as {
      pregunta: string
      contexto: unknown
    }
    expect(body.pregunta).toBe('¿Cuántos empleados hay?')
    expect(body.contexto).toEqual(contexto)
  })

  it('muestra el proveedor y el modelo usado tras responder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          sseResponse([
            { t: 'delta', c: 'Respuesta corta.' },
            {
              t: 'fin',
              proveedor: 'openrouter',
              modelo: 'inclusionai/ling-3.1-flash',
              cache: false,
            },
          ]),
        ),
      ),
    )
    render(<CopilotPanel contexto={contexto} />)
    fireEvent.click(screen.getByRole('button', { name: /vacaciones/i }))
    await waitFor(() => expect(screen.getByText(/ling-3.1-flash/)).toBeInTheDocument())
  })

  it('responde a un error 503 con el mensaje del servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ detail: 'Sin claves de IA' }, 503))),
    )
    render(<CopilotPanel contexto={contexto} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i)
    fireEvent.change(input, { target: { value: 'hola' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText(/Sin claves de IA/)).toBeInTheDocument())
  })

  it('muestra error si todos los modelos fallan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          sseResponse([{ t: 'error', detalle: 'Los modelos gratuitos no respondieron' }]),
        ),
      ),
    )
    render(<CopilotPanel contexto={contexto} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i)
    fireEvent.change(input, { target: { value: 'hola' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() =>
      expect(screen.getByText(/modelos gratuitos no respondieron/)).toBeInTheDocument(),
    )
  })

  it('no envia preguntas vacias', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<CopilotPanel contexto={contexto} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
