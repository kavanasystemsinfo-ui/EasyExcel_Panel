import type { WorkbookFull } from './edit'

type Props = {
  wb: WorkbookFull
  active: string | null
  onSelect: (name: string) => void
  onReset: () => void
}

function formatSincronizado(value: string): string {
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Sidebar({ wb, active, onSelect, onReset }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          E
        </span>
        <div>
          <strong>EasyExcel</strong>
          <span>PANEL</span>
        </div>
      </div>

      <div className="archivo-card">
        <span className="archivo-icon material-symbols-outlined" aria-hidden="true">
          table_view
        </span>
        <div className="archivo-meta">
          <strong title={wb.filename}>{wb.filename}</strong>
          <span>Sincronizado: {formatSincronizado(wb.uploaded_at)}</span>
        </div>
        <button
          type="button"
          className="btn-mini"
          disabled
          title="Sincronización con Drive: pendiente de una fase posterior"
        >
          Forzar Sync
        </button>
      </div>

      <nav className="ws" aria-label="Hojas del libro">
        <p className="ws-title">ESPACIOS DE TRABAJO</p>
        <ul>
          {wb.hojas.map((sheet) => (
            <li key={sheet.name}>
              <button
                type="button"
                className={`sheet-item${sheet.name === active ? ' is-active' : ''}`}
                aria-current={sheet.name === active ? 'page' : undefined}
                onClick={() => onSelect(sheet.name)}
              >
                <span className="sheet-item-name">{sheet.name}</span>
                <span className="sheet-item-count">{sheet.rows.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="side-footer">
        <span className="engine-ok">
          <span className="material-symbols-outlined" aria-hidden="true">
            check_circle
          </span>
          Parsing: openpyxl · OK
        </span>
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Cambiar archivo
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
