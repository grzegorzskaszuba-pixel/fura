const SESSION_TOKEN_KEY = 'fura_session_token'

function hasWindow() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getSessionToken() {
  if (!hasWindow()) {
    return null
  }

  try {
    const token = window.localStorage.getItem(SESSION_TOKEN_KEY)
    return token && token.trim().length > 0 ? token : null
  } catch {
    return null
  }
}

export function setSessionToken(token: string | null | undefined) {
  if (!hasWindow()) {
    return
  }

  try {
    if (!token || token.trim().length === 0) {
      window.localStorage.removeItem(SESSION_TOKEN_KEY)
      return
    }

    window.localStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    // Ignore storage write failures.
  }
}

export function clearSessionToken() {
  setSessionToken(null)
}
