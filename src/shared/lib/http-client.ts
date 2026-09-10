import { getSessionToken } from '@/shared/lib/session-token'

interface HttpRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export async function httpRequest<TResponse>(url: string, init?: HttpRequestInit): Promise<TResponse> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')

  const sessionToken = getSessionToken()

  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`)
  }

  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const isLocalHost = host === 'localhost' || host === '127.0.0.1'
    const message = isLocalHost
      ? 'Brak połączenia z API. Uruchom npm run dev i odśwież stronę.'
      : 'Brak połączenia z API. Sprawdź konfigurację domeny API (DNS/SSL) i spróbuj ponownie.'

    throw new Error(message)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Request failed with status ${response.status}`

    throw new HttpError(message, response.status)
  }

  return payload as TResponse
}
