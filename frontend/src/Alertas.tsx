import type { Kpis } from './kpis'
import { alertasDeSeccion } from './views'

const ICONO: Record<string, string> = {
  danger: 'error',
  warn: 'warning',
  info: 'info',
  ok: 'check_circle',
}

type Props = { kpis: Kpis }

function Alertas({ kpis }: Props) {
  const alertas = alertasDeSeccion(kpis)
  return (
    <section className="alertas-card" aria-label="Alertas del día">
      <header className="panel-head">
        <h3>Alertas del día</h3>
      </header>
      <ul>
        {alertas.map((alerta) => (
          <li key={alerta.id} className={`alerta alerta-${alerta.tono}`}>
            <span className="material-symbols-outlined" aria-hidden="true">
              {ICONO[alerta.tono]}
            </span>
            {alerta.texto}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Alertas
