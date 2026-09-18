export const EMAIL_VERIFICATION_COMPLETED_STORAGE_KEY = 'fura.email-verification-completed'

export function notifyEmailVerificationCompleted() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(EMAIL_VERIFICATION_COMPLETED_STORAGE_KEY, String(Date.now()))
  } catch {
    return
  }
}
