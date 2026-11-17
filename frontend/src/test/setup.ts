import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// El tour se abre solo la primera vez: en las pruebas se da por visto, salvo las suyas.
beforeEach(() => {
  localStorage.setItem('easyexcel-tour-visto', 'true')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
