import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import App from '@/app/App'

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

describe('Terms of Service page', () => {
  it('renders the public terms page at /regulamin without requiring login', () => {
    window.history.pushState({}, '', '/regulamin')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Regulamin FURA' })).toBeInTheDocument()
    expect(screen.getByText(/Użytkownik zachowuje prawa do zdjęć, faktur, dokumentów/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Wróć do FURA' })).toHaveAttribute('href', '/')
  })
})