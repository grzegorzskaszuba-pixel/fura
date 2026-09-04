import type { ProfileCredentials, UserProfile } from '@/shared/types/domain'

export interface AuthService {
  getCurrentProfileId(): Promise<string | null>
  login(input: ProfileCredentials): Promise<UserProfile>
  register(input: ProfileCredentials): Promise<UserProfile>
  loginDemo(): Promise<UserProfile>
  switchProfile(profileId: string): Promise<UserProfile>
  logout(): Promise<void>
}
