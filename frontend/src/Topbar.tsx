import { useEffect, useRef, useState } from 'react'

export type ResultadoGlobal = { hoja: string; fila: number; celda: string }

type Props = {
  sheetCount: number
  query: string
  onQuery: (value: string) => void
  onUploadClick: () => void
  token: string | null
  cambios: number
  onReset: () => void
  resultados?: { total: number; items: ResultadoGlobal[] } | null
  onIrA?: (hoja: string, fila: number) => void
}

function Topbar({
  sheetCount,
  query,
  onQuery,
  onUploadClick,
  token,
  cambios,
  onReset,
  resultados = null,
  onIrA,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function fuera(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1>Panel de Operaciones</h1>
        <span className="topbar-sheets">{sheetCount} hojas</span>
      </div>

      <div className="topbar-search" ref={searchRef}>
        <span className="material-symbols-outlined" aria-hidden="true">
          search
        </span>
        <input
          type="search"
          aria-label="Filtrar filas"
          placeholder="Filtrar filas por cualquier columna…"
          value={query}
          onChange={(event) => {
            onQuery(event.target.value)
            setAbierto(true)
          }}
        />
        {abierto && resultados && resultados.total > 0 ? (
          <div className="search-global" aria-label="Resultados en todo el libro">
            <p className="search-global-head">
              {resultados.total} coincidencia{resultados.total === 1 ? '' : 's'} en el libro
              <button type="button" className="search-global-close" onClick={() => setAbierto(false)}>
                Cerrar
              </button>
            </p>
            {resultados.items.map((item, index) => (
              <button
                key={`${item.hoja}-${item.fila}-${index}`}
                type="button"
                className="search-global-item"
                onClick={() => {
                  setAbierto(false)
                  onIrA?.(item.hoja, item.fila)
                }}
              >
                <span className="search-global-hoja">{item.hoja}</span>
                <span className="search-global-fila">fila {item.fila + 1}</span>
                <span className="search-global-celda">{item.celda}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="topbar-right">
        {token ? (
          <span className="chip-sesion" title={`Tu espacio de trabajo local: ${token}`}>
            <span className="material-symbols-outlined" aria-hidden="true">
              hard_drive
            </span>
            Sesión local {token.slice(0, 8)} ·{' '}
            {cambios === 0
              ? 'sin cambios'
              : `${cambios} cambio${cambios === 1 ? '' : 's'}`}
          </span>
        ) : null}
        <button
          type="button"
          className="btn btn-reset"
          onClick={onReset}
          disabled={!token}
          title="Descartar tus cambios locales y recargar el Excel original"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            restart_alt
          </span>
          Restablecer
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled
          title="IA sin conectar: llega en una fase posterior"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            auto_awesome
          </span>
          Asistente IA
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled
          title="Exportación: Fase 5"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            download
          </span>
          Exportar
        </button>
        <button type="button" className="btn btn-primary" onClick={onUploadClick}>
          Cargar .xlsx
        </button>
        <span className="chip-user" title="Datos de ejemplo, sin cuenta real">
          <span className="avatar-mini" aria-hidden="true">
            D
          </span>
          Modo demo
        </span>
      </div>
    </header>
  )
}

export default Topbar
