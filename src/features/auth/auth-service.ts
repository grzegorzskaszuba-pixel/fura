import type { LoginCredentials, RegisterCredentials, UserProfile } from '@/shared/types/domain'

export interface AuthService {
  getCurrentProfileId(): Promise<string | null>
  login(input: LoginCredentials): Promise<UserProfile>
  register(input: RegisterCredentials): Promise<UserProfile>
  resetPassword(input: LoginCredentials): Promise<void>
  changePassword(profileId: string, input: { currentPassword: string; newPassword: string }): Promise<void>
  logout(): Promise<void>
}
