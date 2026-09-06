import type { AuthService } from '@/features/auth/auth-service'
import { appAuthService } from '@/features/auth/app-auth-service'
import { RemoteAuthService } from '@/features/auth/remote-auth-service'
import { appConfig } from '@/shared/config/app-config'

function createAuthService(): AuthService {
  if (appConfig.authMode === 'remote') {
    return new RemoteAuthService()
  }

  return appAuthService
}

export const authService = createAuthService()
