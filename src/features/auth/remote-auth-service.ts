import type { AuthService, RegistrationProfile } from '@/features/auth/auth-service'
import { appStateRepository } from '@/data/repositories/app-state-repository'
import { appConfig } from '@/shared/config/app-config'
import { httpRequest } from '@/shared/lib/http-client'
import { clearSessionToken, setSessionToken } from '@/shared/lib/session-token'
import type { LoginCredentials, RegisterCredentials, UserProfile } from '@/shared/types/domain'

interface AuthResponse {
  profile: UserProfile
  sessionId?: string
  verificationRequired?: boolean
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

  async register(input: RegisterCredentials): Promise<RegistrationProfile> {
    const response = await httpRequest<AuthResponse>(`${this.baseUrl}/register`, {
      method: 'POST',
      body: input,
    })

    setSessionToken(response.sessionId)

    await appStateRepository.setCurrentProfileId(response.sessionId ? response.profile.id : null)

    return {
      ...response.profile,
      verificationRequired: response.verificationRequired === true,
    }
  }

  async verifyEmail(token: string) {
    await httpRequest<void>(`${this.baseUrl}/verify-email`, {
      method: 'POST',
      body: { token },
    })
  }

  async resendVerificationEmail(username: string) {
    await httpRequest<void>(`${this.baseUrl}/email-verification/resend`, {
      method: 'POST',
      body: { username },
    })
  }

  async requestPasswordReset(username: string) {
    await httpRequest<void>(`${this.baseUrl}/password-reset/request`, {
      method: 'POST',
      body: { username },
    })
  }

  async resetPassword(token: string, newPassword: string) {
    await httpRequest<void>(`${this.baseUrl}/password-reset/confirm`, {
      method: 'POST',
      body: { token, password: newPassword },
    })

    clearSessionToken()
    await appStateRepository.setCurrentProfileId(null)
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

  async deleteAccount(profileId: string) {
    await httpRequest<void>(`${this.baseUrl}/delete-account`, {
      method: 'POST',
      body: {
        profileId,
        confirm: true,
      },
    })

    clearSessionToken()
    await appStateRepository.setCurrentProfileId(null)
  }

  async logout() {
    let requestError: unknown = null

    try {
      await httpRequest<void>(`${this.baseUrl}/logout`, {
        method: 'POST',
      })
    } catch (error) {
      requestError = error
    }

    clearSessionToken()
    await appStateRepository.setCurrentProfileId(null)

    if (requestError) {
      throw requestError
    }
  }
}
