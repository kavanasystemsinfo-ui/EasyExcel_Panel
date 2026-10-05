import type { CoberturaCentro } from './kpis'

type Props = { cobertura: CoberturaCentro[] }

function CoveragePanel({ cobertura }: Props) {
  if (!cobertura.length) return null

  return (
    <section className="panel-card" aria-label="Cobertura por centro">
      <header className="panel-head">
        <div>
          <h3>Cobertura por centro</h3>
          <p>Activos frente a plantilla asignada</p>
        </div>
        <span className="panel-tag">Vivo</span>
      </header>
      <ul className="cov-list">
        {cobertura.map((centro) => {
          const pct = centro.plantilla
            ? Math.min(100, Math.round((centro.activos / centro.plantilla) * 100))
            : 0
          const tono = !centro.plantilla
            ? 'cov-muted'
            : pct >= 100
              ? 'cov-ok'
              : pct >= 80
                ? 'cov-warn'
                : 'cov-danger'
          return (
            <li key={centro.nombre} className="cov-row">
              <span className="cov-name" title={centro.nombre}>
                {centro.nombre}
              </span>
              <span className={`cov-bar ${tono}`}>
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="cov-nums">
                {centro.activos} / {centro.plantilla || '—'}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default CoveragePanel
