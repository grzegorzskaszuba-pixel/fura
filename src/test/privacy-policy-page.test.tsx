import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import App from '@/app/App'

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

describe('Privacy Policy page', () => {
  it('renders the public privacy policy at /polityka-prywatnosci without requiring login', () => {
    window.history.pushState({}, '', '/polityka-prywatnosci')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Polityka prywatności' })).toBeInTheDocument()
    expect(screen.getByText(/Administratorem danych osobowych/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Wróć do FURA' })).toHaveAttribute('href', '/')
  })
})