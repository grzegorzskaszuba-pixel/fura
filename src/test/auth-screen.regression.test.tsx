import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '@/app/App'
import { appAuthService } from '@/features/auth/app-auth-service'
import { AuthScreen } from '@/features/auth/auth-screen'

describe('Auth screen regression', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not expose reset-password tab on login screen', async () => {
    await appAuthService.logout()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Logowanie' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejestracja' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })

  it('uses the interactive brand logo and changes its phase', async () => {
    await appAuthService.logout()
    vi.useFakeTimers()

    render(
      <AuthScreen
        onLogin={async () => undefined}
        onRegister={async () => undefined}
        onResetPassword={async () => undefined}
      />,
    )

    expect(screen.getByText('FURA')).toHaveClass('opacity-100')
    expect(screen.getByText('F', { exact: true })).toHaveClass('opacity-0')

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(screen.getByText('FURA')).toHaveClass('opacity-0')
    expect(screen.getByText('F', { exact: true })).toHaveClass('opacity-100')
  })
})
