import { useEffect, useRef, useState } from 'react'

type Props = {
  modo: 'chip' | 'btn'
  excel: boolean
  onExcel: () => void | Promise<void>
  onPdf: () => void
}

function ExportMenu({ modo, excel, onExcel, onPdf }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function fuera(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  async function exportarExcel() {
    setOcupado(true)
    try {
      await onExcel()
    } finally {
      setOcupado(false)
      setAbierto(false)
    }
  }

  function exportarPdf() {
    setAbierto(false)
    onPdf()
  }

  return (
    <div className="export-wrap" ref={wrapRef}>
      <button
        type="button"
        className={modo === 'chip' ? 'chip' : 'btn btn-ghost'}
        aria-expanded={abierto}
        onClick={() => setAbierto((open) => !open)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          download
        </span>
        Exportar
      </button>
      {abierto ? (
        <div className="export-menu" role="menu" aria-label="Exportar">
          <button
            type="button"
            role="menuitem"
            disabled={!excel || ocupado}
            onClick={() => void exportarExcel()}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              table_view
            </span>
            {ocupado ? 'Generando…' : 'Excel (.xlsx)'}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={ocupado}
            onClick={exportarPdf}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              picture_as_pdf
            </span>
            PDF (imprimir)
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default ExportMenu
