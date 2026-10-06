import { useEffect, useRef, useState } from 'react'

type Props = {
  header: string[]
  mostrarChipActivos: boolean
  soloActivos: boolean
  onSoloActivos: () => void
  ocultas: number[]
  onToggleCol: (index: number) => void
  coincidencias: number | null
  onAddRow: () => void
  onAddCol: () => void
}

function Toolbar({
  header,
  mostrarChipActivos,
  soloActivos,
  onSoloActivos,
  ocultas,
  onToggleCol,
  coincidencias,
  onAddRow,
  onAddCol,
}: Props) {
  const [colsAbiertas, setColsAbiertas] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!colsAbiertas) return
    function fuera(event: MouseEvent) {
      if (colsRef.current && !colsRef.current.contains(event.target as Node)) {
        setColsAbiertas(false)
      }
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [colsAbiertas])

  return (
    <div className="toolbar">
      {mostrarChipActivos ? (
        <button
          type="button"
          className={`chip${soloActivos ? ' is-on' : ''}`}
          aria-pressed={soloActivos}
          onClick={onSoloActivos}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            filter_alt
          </span>
          Solo activos
        </button>
      ) : null}

      {coincidencias !== null ? (
        <span className="toolbar-info">
          {coincidencias} coincidencia{coincidencias === 1 ? '' : 's'} en la página
        </span>
      ) : null}

      <span className="toolbar-sep" aria-hidden="true" />

      <button type="button" className="chip" onClick={onAddRow}>
        <span className="material-symbols-outlined" aria-hidden="true">
          note_add
        </span>
        Nueva fila
      </button>
      <button type="button" className="chip" onClick={onAddCol}>
        <span className="material-symbols-outlined" aria-hidden="true">
          add_column
        </span>
        Nueva columna
      </button>

      <span className="toolbar-sep" aria-hidden="true" />

      <div className="cols-wrap" ref={colsRef}>
        <button
          type="button"
          className="chip"
          aria-expanded={colsAbiertas}
          onClick={() => setColsAbiertas((open) => !open)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            view_column
          </span>
          Columnas
          {ocultas.length ? <span className="chip-badge">{ocultas.length}</span> : null}
        </button>
        {colsAbiertas ? (
          <div className="cols-menu" role="group" aria-label="Columnas visibles">
            {header.map((col, i) => (
              <label key={`${col}-${i}`} className="cols-item">
                <input
                  type="checkbox"
                  checked={!ocultas.includes(i)}
                  onChange={() => onToggleCol(i)}
                />
                {col}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <button type="button" className="chip" disabled title="Exportación: Fase 5">
        <span className="material-symbols-outlined" aria-hidden="true">
          download
        </span>
        Exportar
      </button>
      <span className="toolbar-hint">Doble clic en una celda para editarla</span>
    </div>
  )
}

export default Toolbar
