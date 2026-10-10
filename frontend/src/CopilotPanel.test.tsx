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
    render(<CopilotPanel contexto={contexto} abierto onToggle={vi.fn()} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i) as HTMLInputElement
    expect(input.disabled).toBe(false)
    expect(screen.getByText(/información personal/i)).toBeInTheDocument()
  })

  it('la cabecera alterna el panel (desplegar/ocultar)', () => {
    const onToggle = vi.fn()
    render(<CopilotPanel contexto={contexto} abierto onToggle={onToggle} />)
    const cabecera = screen.getByRole('button', { name: /asistente ia/i })
    expect(cabecera).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(cabecera)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('oculto muestra solo la cabecera', () => {
    render(<CopilotPanel contexto={contexto} abierto={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: /asistente ia/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByLabelText(/pregunta al copiloto/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/información personal/i)).not.toBeInTheDocument()
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

    render(<CopilotPanel contexto={contexto} abierto onToggle={vi.fn()} />)
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

  it('renderiza la negrita markdown de la respuesta sin mostrar asteriscos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          sseResponse([
            { t: 'delta', c: '**ESTADO GENERAL:** 30 bajas y ' },
            { t: 'delta', c: '59 solicitudes pendientes.\\n\\n**URGENTES:**\\n- 30 bajas.' },
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

    render(<CopilotPanel contexto={contexto} abierto onToggle={vi.fn()} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i)
    fireEvent.change(input, { target: { value: '¿Cómo va el día?' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const respuesta = await screen.findByRole('status')
    await waitFor(() => expect(respuesta.textContent).toContain('URGENTES:'))
    expect(respuesta.textContent).not.toContain('**')
    const strongs = respuesta.querySelectorAll('strong')
    expect(strongs.length).toBeGreaterThanOrEqual(2)
    expect(strongs[0]?.textContent).toBe('ESTADO GENERAL:')
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
    render(<CopilotPanel contexto={contexto} abierto onToggle={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /vacaciones/i }))
    await waitFor(() => expect(screen.getByText(/ling-3.1-flash/)).toBeInTheDocument())
  })

  it('responde a un error 503 con el mensaje del servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ detail: 'Sin claves de IA' }, 503))),
    )
    render(<CopilotPanel contexto={contexto} abierto onToggle={vi.fn()} />)
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
    render(<CopilotPanel contexto={contexto} abierto onToggle={vi.fn()} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i)
    fireEvent.change(input, { target: { value: 'hola' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() =>
      expect(screen.getByText(/modelos gratuitos no respondieron/)).toBeInTheDocument(),
    )
  })

  it('la primera sugerencia es el resumen del día y se envía al pulsarla', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        sseResponse([
          { t: 'delta', c: 'El día va estable: 130 activos de 215.' },
          { t: 'fin', proveedor: 'openrouter', modelo: 'north', cache: false },
        ]),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<CopilotPanel contexto={contexto} abierto onToggle={vi.fn()} />)
    const chips = Array.from(document.querySelectorAll('.copilot-chips .chip')).map(
      (chip) => chip.textContent,
    )
    expect(chips[0]).toBe('¿Cómo va el día?')
    expect(chips.length).toBeGreaterThanOrEqual(5)
    expect(chips.join(' ')).toMatch(/vacaciones/)

    fireEvent.click(screen.getByRole('button', { name: '¿Cómo va el día?' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const llamada = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(llamada[1].body)) as { pregunta: string }
    expect(body.pregunta).toBe('¿Cómo va el día?')
  })

  it('no envia preguntas vacias', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<CopilotPanel contexto={contexto} abierto onToggle={vi.fn()} />)
    const input = screen.getByLabelText(/pregunta al copiloto/i)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

