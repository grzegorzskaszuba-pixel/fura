import type { LoginCredentials, RegisterCredentials, UserProfile } from '@/shared/types/domain'

export type RegistrationProfile = UserProfile & {
  verificationRequired?: boolean
}

export interface AuthService {
  getCurrentProfileId(): Promise<string | null>
  login(input: LoginCredentials): Promise<UserProfile>
  register(input: RegisterCredentials): Promise<RegistrationProfile>
  verifyEmail(token: string): Promise<void>
  resendVerificationEmail(username: string): Promise<void>
  requestPasswordReset(username: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
  changePassword(profileId: string, input: { currentPassword: string; newPassword: string }): Promise<void>
  deleteAccount(profileId: string): Promise<void>
  logout(): Promise<void>
}
