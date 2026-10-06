import { useEffect, useRef, useState } from 'react'
import {
  esColumnaEstado,
  esColumnaId,
  esColumnaNombre,
  formatCelda,
  num,
  tonoEstado,
  type Tono,
} from './cells'

type Props = {
  sheetName: string
  header: string[]
  rows: unknown[][]
  total: number
  offset: number
  limit: number
  onPage: (offset: number) => void
  hiddenCols?: number[]
  filtered?: boolean
  onEdit?: (fila: number, col: number, valor: unknown) => void
  onDeleteRow?: (fila: number) => void
}

type Edicion = { fila: number; col: number; borrador: string; original: unknown }

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0] ?? '')
    .join('')
    .toUpperCase()
}

function ventanaPaginas(paginas: number, actual: number): (number | 'gap')[] {
  if (paginas <= 7) {
    return Array.from({ length: paginas }, (_, i) => i + 1)
  }
  const set = new Set<number>([1, paginas])
  for (let p = actual - 1; p <= actual + 1; p++) {
    if (p >= 1 && p <= paginas) set.add(p)
  }
  if (actual <= 4) {
    for (let p = 2; p <= 5; p++) set.add(p)
  }
  if (actual >= paginas - 4) {
    for (let p = paginas - 4; p <= paginas - 1; p++) {
      if (p >= 2) set.add(p)
    }
  }
  const orden = [...set].sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  let previo = 0
  for (const n of orden) {
    if (previo && n - previo > 1) out.push('gap')
    out.push(n)
    previo = n
  }
  return out
}

function coerce(borrador: string, original: unknown): unknown {
  if (typeof original === 'number') {
    const n = num(borrador)
    return Number.isFinite(n) ? n : borrador
  }
  return borrador
}

function Badge({ valor }: { valor: unknown }) {
  const tono: Tono = tonoEstado(valor)
  const texto = String(valor ?? '').trim()
  if (!texto) return null
  return <span className={`badge badge-${tono}`}>{texto}</span>
}

function GridView({
  sheetName,
  header,
  rows,
  total,
  offset,
  limit,
  onPage,
  hiddenCols = [],
  filtered = false,
  onEdit,
  onDeleteRow,
}: Props) {
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const claveVista = `${sheetName}:${offset}`
  const [clavePrevia, setClavePrevia] = useState(claveVista)
  if (clavePrevia !== claveVista) {
    setClavePrevia(claveVista)
    setEdicion(null)
  }

  useEffect(() => {
    if (edicion) inputRef.current?.focus()
  }, [edicion])

  const visibles = header.map((_, i) => i).filter((i) => !hiddenCols.includes(i))
  const iDni = header.findIndex((col) => /\b(dni|nie|nif)\b/i.test(col))
  const paginas = Math.max(1, Math.ceil(total / limit))
  const actual = Math.floor(offset / limit) + 1
  const numeros = ventanaPaginas(paginas, actual)

  function abrir(fila: number, col: number, valor: unknown) {
    if (!onEdit) return
    setEdicion({ fila, col, borrador: String(valor ?? ''), original: valor })
  }

  function confirmar() {
    if (!edicion || !onEdit) return
    const valor = coerce(edicion.borrador, edicion.original)
    const cambio = String(valor ?? '') !== String(edicion.original ?? '')
    setEdicion(null)
    if (cambio) onEdit(edicion.fila, edicion.col, valor)
  }

  function cancelar() {
    setEdicion(null)
  }

  return (
    <div className="grid-card">
      <div className="grid-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="col-num" scope="col">
                #
              </th>
              {visibles.map((i) => (
                <th key={`${header[i]}-${i}`} scope="col">
                  {header[i]}
                </th>
              ))}
              <th className="col-actions" scope="col">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((fila, r) => {
              const filaGlobal = offset + r
              return (
                <tr key={`${sheetName}-${filaGlobal}`}>
                  <td className="col-num">{filaGlobal + 1}</td>
                  {visibles.map((i) => {
                    const col = header[i]
                    const value = fila[i]
                    const enEdicion = edicion?.fila === filaGlobal && edicion?.col === i
                    if (enEdicion) {
                      return (
                        <td key={`${col}-${i}`} className="cell-editing">
                          <input
                            ref={inputRef}
                            aria-label={`Editar ${col}`}
                            value={edicion.borrador}
                            onChange={(event) =>
                              setEdicion({ ...edicion, borrador: event.target.value })
                            }
                            onBlur={confirmar}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') confirmar()
                              if (event.key === 'Escape') cancelar()
                            }}
                          />
                        </td>
                      )
                    }
                    if (esColumnaNombre(col)) {
                      return (
                        <td
                          key={`${col}-${i}`}
                          onDoubleClick={() => abrir(filaGlobal, i, value)}
                          className={onEdit ? 'cell-editable' : undefined}
                        >
                          <span className="cell-name">
                            <span className="avatar-circle" aria-hidden="true">
                              {iniciales(String(value ?? ''))}
                            </span>
                            <span>
                              <span className="name-main">{String(value ?? '')}</span>
                              {iDni >= 0 && iDni !== i ? (
                                <span className="name-sub">{String(fila[iDni] ?? '')}</span>
                              ) : null}
                            </span>
                          </span>
                        </td>
                      )
                    }
                    if (esColumnaEstado(col)) {
                      return (
                        <td
                          key={`${col}-${i}`}
                          onDoubleClick={() => abrir(filaGlobal, i, value)}
                          className={onEdit ? 'cell-editable' : undefined}
                        >
                          <Badge valor={value} />
                        </td>
                      )
                    }
                    const texto = formatCelda(col, value)
                    const clase = [
                      esColumnaId(col) ? 'cell-id' : '',
                      typeof value === 'number' ? 'cell-num' : '',
                      onEdit ? 'cell-editable' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <td
                        key={`${col}-${i}`}
                        className={clase}
                        onDoubleClick={() => abrir(filaGlobal, i, value)}
                      >
                        {texto}
                      </td>
                    )
                  })}
                  <td className="col-actions">
                    {onDeleteRow ? (
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        aria-label="Eliminar fila"
                        title="Eliminar esta fila"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la fila ${filaGlobal + 1}?`)) {
                            onDeleteRow(filaGlobal)
                          }
                        }}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          delete
                        </span>
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="grid-empty" colSpan={visibles.length + 2}>
                  Sin filas que mostrar con el filtro actual.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid-foot">
        <span className="grid-count">
          {filtered
            ? `${rows.length} de ${total} filas en la página ${actual} (filtro activo)`
            : `Mostrando ${total ? offset + 1 : 0}–${offset + rows.length} de ${total} filas`}
        </span>
        <nav className="pager" aria-label="Paginación">
          <button
            type="button"
            disabled={actual <= 1}
            onClick={() => onPage(Math.max(0, offset - limit))}
          >
            Anterior
          </button>
          {numeros.map((n) =>
            n === 'gap' ? (
              <span key="gap" className="pager-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                aria-current={n === actual ? 'page' : undefined}
                onClick={() => onPage((n - 1) * limit)}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={actual >= paginas}
            onClick={() => onPage(offset + limit)}
          >
            Siguiente
          </button>
        </nav>
      </div>
    </div>
  )
}

export default GridView
