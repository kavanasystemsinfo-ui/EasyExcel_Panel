import type { Kpis } from './kpis'

type Props = { kpis: Kpis }

type Tarjeta = {
  key: string
  overline: string
  icon: string
  valor: string
  sufijo?: string
  sub?: string
  chip?: string
  footer: { izq: string; izqTono: string; der: string; derTono: string }
  barra?: number
  chips?: string[]
}

function tonoClase(tono: string): string {
  return `kpi-foot-${tono}`
}

function tarjetas(k: Kpis): Tarjeta[] {
  const out: Tarjeta[] = []

  if (k.plantilla) {
    const p = k.plantilla
    const pctActivos = p.total ? Math.round((p.activos / p.total) * 100) : 0
    out.push({
      key: 'plantilla',
      overline: 'PLANTILLA ACTIVA',
      icon: 'groups',
      valor: p.activos.toLocaleString('es-ES'),
      sufijo: `/ ${p.total.toLocaleString('es-ES')}`,
      sub: `${p.completas} Completa (40h) · ${p.parciales} Parcial`,
      footer: {
        izq: `• ${p.bajas} Baja${p.bajas === 1 ? '' : 's'}`,
        izqTono: p.bajas > 0 ? 'danger' : 'muted',
        der: `${pctActivos}% activos`,
        derTono: 'ok',
      },
    })
  }

  if (k.centros) {
    const c = k.centros
    const pct = c.total ? Math.round((c.activos / c.total) * 100) : 0
    out.push({
      key: 'centros',
      overline: 'CENTROS OPERATIVOS',
      icon: 'apartment',
      valor: String(c.activos),
      sufijo: `/ ${c.total}`,
      chip: pct === 100 ? '100% OK' : `${pct}% activos`,
      sub: `${c.vigentes} asignaciones vigentes`,
      footer: {
        izq: `• ${c.vigentes} vigentes`,
        izqTono: 'info',
        der: `${c.historicas} históricas`,
        derTono: 'muted',
      },
    })
  }

  if (k.turnos) {
    const t = k.turnos
    const total = t.manana + t.tarde + t.noche + t.rotativo + t.otros
    const chips = [`M ${t.manana}`, `T ${t.tarde}`, `N ${t.noche}`, `R ${t.rotativo}`]
    if (t.otros > 0) chips.push(`+ ${t.otros}`)
    out.push({
      key: 'turnos',
      overline: 'TURNOS EN CURSO',
      icon: 'timelapse',
      valor: String(total),
      chips,
      sub: 'Distribución entre activos',
      footer: {
        izq: `+Plus Noche: ${t.conPlusNoche}`,
        izqTono: 'ok',
        der: `${t.noche} en turno de noche`,
        derTono: 'info',
      },
    })
  }

  if (k.vacaciones) {
    const v = k.vacaciones
    out.push({
      key: 'vacaciones',
      overline: 'VACACIONES EN CURSO',
      icon: 'beach_access',
      valor: String(v.hoy),
      sub: v.cumple30
        ? 'Conforme a ≤ 30 días máx.'
        : `⚠ Tramos de hasta ${v.maxDias} días (> 30 máx.)`,
      footer: {
        izq: `• ${v.pendientes} pendientes`,
        izqTono: v.pendientes > 0 ? 'warn' : 'muted',
        der: v.cumple30 ? 'Conforme' : 'Revisar',
        derTono: v.cumple30 ? 'ok' : 'danger',
      },
    })
  }

  if (k.maquinaria) {
    const m = k.maquinaria
    out.push({
      key: 'maquinaria',
      overline: 'MAQUINARIA OPERATIVA',
      icon: 'precision_manufacturing',
      valor: String(m.operativas),
      sufijo: `/ ${m.total}`,
      sub: `${m.pct}% operativa`,
      barra: m.pct,
      footer: {
        izq: `• ${m.proximas30} revisión en 30 días`,
        izqTono: 'info',
        der: `${m.vencidas} vencidas`,
        derTono: m.vencidas > 0 ? 'danger' : 'ok',
      },
    })
  }

  if (k.calidad) {
    const q = k.calidad
    out.push({
      key: 'calidad',
      overline: 'CALIDAD',
      icon: 'verified',
      valor: `${q.media}%`,
      sub: `Media de ${q.total} auditorías`,
      footer: {
        izq: `✓ ${q.conformes} conformes`,
        izqTono: 'ok',
        der: `de ${q.total}`,
        derTono: 'muted',
      },
    })
  }

  return out
}

function KpiCards({ kpis }: Props) {
  const tarjetasVisibles = tarjetas(kpis)
  if (!tarjetasVisibles.length) return null

  return (
    <section className="kpi-grid" aria-label="Indicadores">
      {tarjetasVisibles.map((card) => (
        <article key={card.key} className="kpi-card">
          <div className="kpi-top">
            <p className="kpi-overline">{card.overline}</p>
            <span className="kpi-icon material-symbols-outlined" aria-hidden="true">
              {card.icon}
            </span>
          </div>
          <p className="kpi-value">
            {card.valor}
            {card.sufijo ? <span className="kpi-sufijo">{card.sufijo}</span> : null}
            {card.chip ? <span className="badge badge-ok">{card.chip}</span> : null}
          </p>
          {card.chips ? (
            <p className="kpi-chips">
              {card.chips.map((chip) => (
                <span key={chip} className="kpi-chip">
                  {chip}
                </span>
              ))}
            </p>
          ) : null}
          {card.sub ? <p className="kpi-sub">{card.sub}</p> : null}
          {typeof card.barra === 'number' ? (
            <div
              className="kpi-bar"
              role="progressbar"
              aria-valuenow={card.barra}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Porcentaje operativa"
            >
              <span style={{ width: `${card.barra}%` }} />
            </div>
          ) : null}
          <p className="kpi-footer">
            <span className={tonoClase(card.footer.izqTono)}>{card.footer.izq}</span>
            <span className={tonoClase(card.footer.derTono)}>{card.footer.der}</span>
          </p>
        </article>
      ))}
    </section>
  )
}

export default KpiCards
