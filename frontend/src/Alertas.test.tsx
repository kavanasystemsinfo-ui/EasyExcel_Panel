import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Alertas from './Alertas'

describe('Alertas', () => {
  it('muestra el listado con su tono', () => {
    render(
      <Alertas
        kpis={{
          vacaciones: { hoy: 3, pendientes: 59, cumple30: true, maxDias: 30 },
        }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Alertas del día' })).toBeInTheDocument()
    const item = screen.getByText('59 solicitudes de vacaciones pendientes')
    expect(item.closest('li')?.className).toContain('alerta-warn')
  })

  it('muestra el estado calmado sin incidencias', () => {
    render(<Alertas kpis={{}} />)
    expect(screen.getByText('Sin incidencias pendientes')).toBeInTheDocument()
  })
})
