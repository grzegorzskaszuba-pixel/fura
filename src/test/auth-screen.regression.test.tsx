import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '@/app/App'
import { appAuthService } from '@/features/auth/app-auth-service'
import { EMAIL_VERIFICATION_COMPLETED_STORAGE_KEY } from '@/features/auth/email-verification-events'
import { EmailVerificationPending } from '@/features/auth/email-verification-pending'
import { AuthScreen } from '@/features/auth/auth-screen'
import { EmailVerificationScreen } from '@/features/auth/email-verification-screen'
import { PasswordResetScreen } from '@/features/auth/password-reset-screen'

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

  it('requests a password reset link from the login screen', async () => {
    const user = userEvent.setup()
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined)

    render(
      <AuthScreen
        onLogin={async () => undefined}
        onRegister={async () => undefined}
        onRequestPasswordReset={requestPasswordReset}
        allowResetPassword
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Nie pamiętam hasła' }))
    await user.type(screen.getByLabelText('E-mail użytkownika'), 'driver@example.com')
    await user.click(screen.getByRole('button', { name: 'Wyślij link resetujący' }))

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith('driver@example.com')
    })
    expect(screen.getByText('Jeśli konto jest przypisane do tego adresu, link resetujący został wysłany. Sprawdź skrzynkę pocztową.')).toBeInTheDocument()
  })

  it('styles the password reset link with the requested size and spacing', () => {
    render(
      <AuthScreen
        onLogin={async () => undefined}
        onRegister={async () => undefined}
        onRequestPasswordReset={async () => undefined}
        allowResetPassword
      />,
    )

    const resetLink = screen.getByRole('button', { name: 'Nie pamiętam hasła' })

    expect(resetLink).toHaveClass('text-xs')
    expect(resetLink.parentElement).toHaveClass('gap-[22px]')
  })

  it('sets a new password from a reset link', async () => {
    const user = userEvent.setup()
    const resetPassword = vi.fn().mockResolvedValue(undefined)

    render(<PasswordResetScreen token="reset-token" onReset={resetPassword} onBackToLogin={() => undefined} />)

    await user.type(screen.getByLabelText('Nowe hasło'), 'new-pass-1')
    await user.type(screen.getByLabelText('Powtórz nowe hasło'), 'new-pass-1')
    await user.click(screen.getByRole('button', { name: 'Ustaw nowe hasło' }))

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith('reset-token', 'new-pass-1')
    })
    expect(screen.getByText('Hasło zostało zmienione')).toBeInTheDocument()
  })

  it('settles the verification result when StrictMode replays the effect', async () => {
    render(
      <StrictMode>
        <EmailVerificationScreen
          token="invalid-token"
          onVerify={async () => {
            throw new Error('Link weryfikacyjny jest nieprawidłowy, zużyty lub wygasł')
          }}
          onBackToLogin={() => undefined}
        />
      </StrictMode>,
    )

    await waitFor(() => {
      expect(screen.getByText('Link weryfikacyjny jest nieprawidłowy, zużyty lub wygasł')).toBeInTheDocument()
    })
  })

  it('updates the pending screen when verification completes in another tab', async () => {
    render(
      <EmailVerificationPending
        email="tester@example.com"
        onResend={async () => undefined}
        onBackToLogin={() => undefined}
      />,
    )

    expect(screen.getByText('Wysłaliśmy link potwierdzający na adres:')).toBeInTheDocument()
    expect(screen.getByText('tester@example.com')).toBeInTheDocument()
    expect(screen.getByText('Link jest ważny przez 24 godziny.')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: EMAIL_VERIFICATION_COMPLETED_STORAGE_KEY, newValue: '1' }))
    })

    expect(await screen.findByText('Adres e-mail został potwierdzony w innej karcie. Wróć do logowania.')).toBeInTheDocument()
  })
})
