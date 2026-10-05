import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('muestra el nombre del proyecto y el estado de la fase', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'EasyExcel Panel' })).toBeInTheDocument()
    expect(screen.getByText(/Fase 1/)).toBeInTheDocument()
  })
})
