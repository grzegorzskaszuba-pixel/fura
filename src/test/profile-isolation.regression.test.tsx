import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from '@/app/App'
import { appAuthService } from '@/features/auth/app-auth-service'

describe('Profile isolation regression', () => {
  it('does not display other local profiles in profile menu', async () => {
    const secondaryUsername = `other-${Date.now()}@example.com`

    await appAuthService.register({
      username: secondaryUsername,
      displayName: 'Other Profile',
      password: 'haslo123',
      termsAccepted: true,
    })

    await appAuthService.login({
      username: 'tester@example.com',
      password: 'haslo123',
    })

    render(<App />)
    await screen.findByTestId('active-vehicle-name')

    const user = userEvent.setup()
    await user.click(screen.getByTestId('profile-menu-trigger'))

    await waitFor(() => {
      expect(screen.getByText('Wyloguj')).toBeInTheDocument()
    })

    expect(screen.queryByText(secondaryUsername)).not.toBeInTheDocument()
    expect(screen.queryByText('Other Profile')).not.toBeInTheDocument()
    expect(screen.queryByText('Profile lokalne')).not.toBeInTheDocument()
  })
})
