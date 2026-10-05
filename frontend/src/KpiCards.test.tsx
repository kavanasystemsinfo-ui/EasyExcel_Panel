import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import KpiCards from './KpiCards'
import type { Kpis } from './kpis'

const kpis: Kpis = {
  plantilla: { activos: 130, total: 215, completas: 41, parciales: 174, bajas: 30 },
  centros: { activos: 7, total: 7, vigentes: 185, historicas: 249 },
  turnos: { manana: 23, tarde: 20, noche: 29, rotativo: 31, otros: 27, conPlusNoche: 29 },
  vacaciones: { hoy: 20, pendientes: 59, maxDias: 45, cumple30: false },
  maquinaria: { operativas: 43, total: 51, pct: 84, vencidas: 0, proximas30: 15 },
  calidad: { media: 85, total: 39, conformes: 11 },
}

describe('KpiCards', () => {
  it('pinta las seis tarjetas con valores calculados', () => {
    render(<KpiCards kpis={kpis} />)
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.getByText('PLANTILLA ACTIVA')).toBeInTheDocument()
    expect(screen.getByText(/41 Completa/)).toBeInTheDocument()
    expect(screen.getByText('• 30 Bajas')).toBeInTheDocument()
    expect(screen.getByText('100% OK')).toBeInTheDocument()
    expect(screen.getByText('+Plus Noche: 29')).toBeInTheDocument()
    expect(screen.getByText('Revisar')).toBeInTheDocument()
    expect(screen.getByText('• 15 revisión en 30 días')).toBeInTheDocument()
    expect(screen.getByText('✓ 11 conformes')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '84')
  })

  it('solo pinta las tarjetas cuyas hojas existen', () => {
    render(<KpiCards kpis={{ calidad: kpis.calidad! }} />)
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('CALIDAD')).toBeInTheDocument()
    expect(screen.queryByText('PLANTILLA ACTIVA')).not.toBeInTheDocument()
  })

  it('sin kpis calculados no pinta la seccion', () => {
    const { container } = render(<KpiCards kpis={{}} />)
    expect(container.querySelector('.kpi-grid')).not.toBeInTheDocument()
  })
})
