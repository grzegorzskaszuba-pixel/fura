import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '@/app/App'
import { appAuthService } from '@/features/auth/app-auth-service'

describe('Auth screen regression', () => {
  it('does not expose reset-password tab on login screen', async () => {
    await appAuthService.logout()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Logowanie' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejestracja' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })
})
