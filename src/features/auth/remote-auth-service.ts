import type { AuthService } from '@/features/auth/auth-service'
import { appStateRepository } from '@/data/repositories/app-state-repository'
import { appConfig } from '@/shared/config/app-config'
import { httpRequest } from '@/shared/lib/http-client'
import { clearSessionToken, setSessionToken } from '@/shared/lib/session-token'
import type { LoginCredentials, RegisterCredentials, UserProfile } from '@/shared/types/domain'

interface AuthResponse {
  profile: UserProfile
  sessionId?: string
}

interface SessionResponse {
  profileId: string | null
}

export class RemoteAuthService implements AuthService {
  private readonly baseUrl = `${appConfig.apiBaseUrl}/auth`

  async getCurrentProfileId() {
    const response = await httpRequest<SessionResponse>(`${this.baseUrl}/session`)
    if (!response.profileId) {
      clearSessionToken()
    }
    await appStateRepository.setCurrentProfileId(response.profileId)
    return response.profileId
  }

  async login(input: LoginCredentials) {
    const response = await httpRequest<AuthResponse>(`${this.baseUrl}/login`, {
      method: 'POST',
      body: input,
    })

    setSessionToken(response.sessionId)

    await appStateRepository.setCurrentProfileId(response.profile.id)

    return response.profile
  }

  async register(input: RegisterCredentials) {
    const response = await httpRequest<AuthResponse>(`${this.baseUrl}/register`, {
      method: 'POST',
      body: input,
    })

    setSessionToken(response.sessionId)

    await appStateRepository.setCurrentProfileId(response.profile.id)

    return response.profile
  }

  async resetPassword(input: LoginCredentials) {
    void input
    throw new Error('Reset hasła jest niedostępny. Zaloguj się i użyj opcji "Zmień hasło".')
  }

  async changePassword(profileId: string, input: { currentPassword: string; newPassword: string }) {
    await httpRequest<void>(`${this.baseUrl}/change-password`, {
      method: 'POST',
      body: {
        profileId,
        ...input,
      },
    })
  }

  async logout() {
    await httpRequest<void>(`${this.baseUrl}/logout`, {
      method: 'POST',
    })

    clearSessionToken()
    await appStateRepository.setCurrentProfileId(null)
  }
}
