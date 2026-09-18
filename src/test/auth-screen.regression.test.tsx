import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '@/app/App'
import { appAuthService } from '@/features/auth/app-auth-service'
import { AuthScreen } from '@/features/auth/auth-screen'
import { EmailVerificationScreen } from '@/features/auth/email-verification-screen'

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

  it('shows the verification error instead of keeping the loading state', async () => {
    render(
      <EmailVerificationScreen
        token="invalid-token"
        onVerify={async () => {
          throw new Error('Link weryfikacyjny jest nieprawidłowy, zużyty lub wygasł')
        }}
        onBackToLogin={() => undefined}
      />,
    )

    expect(screen.getByText('Potwierdzanie adresu e-mail...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Link weryfikacyjny jest nieprawidłowy, zużyty lub wygasł')).toBeInTheDocument()
    })

    expect(screen.queryByText('Potwierdzanie adresu e-mail...')).not.toBeInTheDocument()
  })
})
