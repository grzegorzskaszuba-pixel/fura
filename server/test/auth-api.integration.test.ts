// @vitest-environment node

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

async function findFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()

      if (!address || typeof address === 'string') {
        reject(new Error('Cannot allocate free port'))
        return
      }

      const port = address.port
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(port)
      })
    })
  })
}

async function waitForServer(baseUrl: string, timeoutMs: number) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`)

      if (response.ok) {
        return
      }
    } catch {
      // Retry until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error('Auth API did not start in time')
}

describe('auth API integration', () => {
  let apiProcess: ChildProcessWithoutNullStreams | null = null
  let baseUrl = ''
  let tempDir = ''
  let sessionCookie = ''

  async function apiRequest(pathname: string, options?: { method?: string; body?: unknown }) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (sessionCookie) {
      headers.cookie = sessionCookie
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    })

    const setCookie = response.headers.get('set-cookie')

    if (setCookie) {
      sessionCookie = setCookie.split(';', 1)[0] ?? ''
    }

    return response
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'carlog-auth-api-'))
    const dbFile = path.join(tempDir, 'auth-db.json')
    const port = await findFreePort()
    baseUrl = `http://127.0.0.1:${port}`

    apiProcess = spawn(process.execPath, ['server/auth-server.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUTH_API_PORT: String(port),
        AUTH_API_HOST: '127.0.0.1',
        AUTH_API_ALLOWED_ORIGINS: '*',
        AUTH_DB_FILE: dbFile,
      },
      stdio: 'pipe',
    })

    await waitForServer(baseUrl, 8000)
  })

  afterAll(async () => {
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill('SIGTERM')
    }

    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns only current session profile from /api/profiles', async () => {
    const stamp = Date.now()

    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: `user_${stamp}_a`,
        displayName: 'User A',
        password: 'secret123',
      },
    })

    const registerB = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: `user_${stamp}_b`,
        displayName: 'User B',
        password: 'secret123',
      },
    })

    expect(registerB.status).toBe(200)

    const profilesResponse = await apiRequest('/api/profiles')
    const payload = (await profilesResponse.json()) as { profiles: Array<{ username: string }> }

    expect(profilesResponse.status).toBe(200)
    expect(payload.profiles).toHaveLength(1)
    expect(payload.profiles[0]?.username).toBe(`user_${stamp}_b`)
  })

  it('rejects reset-password without active session', async () => {
    sessionCookie = ''

    const response = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        username: 'someone',
        password: 'another123',
      },
    })

    expect(response.status).toBe(403)
  })

  it('does not expose switch-profile endpoint', async () => {
    const response = await apiRequest('/api/auth/switch-profile', {
      method: 'POST',
      body: { profileId: 'any-profile-id' },
    })

    expect(response.status).toBe(404)
  })
})
