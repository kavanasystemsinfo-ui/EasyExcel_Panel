import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportSheet } from './api'
import { descargarBlob, nombreExport, payloadExport } from './export'

describe('exportSheet', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hace POST al endpoint de export y devuelve el blob', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('xlsx-bytes', {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const payload = { header: ['A'], rows: [[1]] }
    const result = await exportSheet('wb-1', 'Ventas 2026', payload)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/workbooks/wb-1/sheets/Ventas%202026/export')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(payload)
    expect(result).toBeInstanceOf(Blob)
    expect(await result.text()).toBe('xlsx-bytes')
  })

  it('lanza el detalle del servidor si algo va mal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'La hoja no existe' }), { status: 404 }),
      ),
    )
    await expect(exportSheet('wb-1', 'Nope', { header: ['A'], rows: [] })).rejects.toThrow(
      'La hoja no existe',
    )
  })
})

describe('nombreExport', () => {
  it('combina libro y hoja con extension xlsx', () => {
    expect(nombreExport('informe_2026.xlsx', 'Ventas 2026')).toBe(
      'informe_2026_Ventas 2026.xlsx',
    )
  })

  it('sustituye caracteres prohibidos', () => {
    expect(nombreExport('a/b:c.xlsx', 'X|Y')).toBe('a_b_c_X_Y.xlsx')
  })

  it('sin extension tambien funciona', () => {
    expect(nombreExport('libro', 'Hoja1')).toBe('libro_Hoja1.xlsx')
  })
})

describe('payloadExport', () => {
  const header = ['Producto', 'Unidades', 'Importe']

  it('envia solo las columnas visibles con sus filas', () => {
    const payload = payloadExport(header, [1], [
      ['Sofa', 3, 450.5],
      ['Mesa', 1, 120],
    ])
    expect(payload.header).toEqual(['Producto', 'Importe'])
    expect(payload.rows).toEqual([
      ['Sofa', 450.5],
      ['Mesa', 120],
    ])
  })

  it('mantiene tipos primitivos y convierte el resto a texto', () => {
    const payload = payloadExport(['A', 'B', 'C'], [], [
      [true, new Date('2026-01-02T03:04:05.000Z'), { x: 1 }],
    ])
    expect(payload.rows).toEqual([
      [true, '2026-01-02T03:04:05.000Z', '[object Object]'],
    ])
  })

  it('rellena con null las celdas ausentes', () => {
    const payload = payloadExport(['A', 'B'], [], [[], ['x']])
    expect(payload.rows).toEqual([[null, null], ['x', null]])
  })

  it('sin columnas ocultas devuelve todo', () => {
    const payload = payloadExport(header, [], [['Silla', 10, 300]])
    expect(payload.header).toEqual(header)
    expect(payload.rows).toEqual([['Silla', 10, 300]])
  })
})

describe('descargarBlob', () => {
  const createObjectURL = vi.fn(() => 'blob:fake')
  const revokeObjectURL = vi.fn()

  afterEach(() => {
    vi.restoreAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (URL as any).createObjectURL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (URL as any).revokeObjectURL
  })

  it('crea un enlace temporal con el nombre dado y lo pulsa', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(URL as any).createObjectURL = createObjectURL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(URL as any).revokeObjectURL = revokeObjectURL
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const blob = new Blob(['hola'])

    descargarBlob(blob, 'libro_Hoja.xlsx')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })
})
