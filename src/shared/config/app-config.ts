type AuthMode = 'local' | 'remote'

function readAuthMode(): AuthMode {
  return import.meta.env.MODE === 'test' ? 'local' : 'remote'
}

function readApiBaseUrl() {
  const value = String(import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
  return value.length > 0 ? value : '/api'
}

export const appConfig = {
  authMode: readAuthMode(),
  apiBaseUrl: readApiBaseUrl(),
}
