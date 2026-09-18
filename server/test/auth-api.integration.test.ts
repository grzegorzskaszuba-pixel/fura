// @vitest-environment node

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import crypto from 'node:crypto'
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
    const legacySalt = 'legacy-salt-for-api-test'
    const legacyPasswordHash = crypto.scryptSync('legacy-pass-1', legacySalt, 64).toString('hex')

    await writeFile(
      dbFile,
      JSON.stringify({
        profiles: [
          {
            id: 'legacy-profile-api-test',
            username: 'legacy_api_user',
            displayName: 'Legacy API User',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        credentials: [
          {
            profileId: 'legacy-profile-api-test',
            username: 'legacy_api_user',
            passwordHash: legacyPasswordHash,
            passwordSalt: legacySalt,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        vehicles: [],
        serviceEvents: [],
      }),
      'utf8',
    )

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
        username: `user_${stamp}_a@example.com`,
        displayName: 'User A',
        password: 'secret123',
      },
    })

    const registerB = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: `user_${stamp}_b@example.com`,
        displayName: 'User B',
        password: 'secret123',
      },
    })

    expect(registerB.status).toBe(200)

    const profilesResponse = await apiRequest('/api/profiles')
    const payload = (await profilesResponse.json()) as { profiles: Array<{ username: string }> }

    expect(profilesResponse.status).toBe(200)
    expect(payload.profiles).toHaveLength(1)
    expect(payload.profiles[0]?.username).toBe(`user_${stamp}_b@example.com`)
  })

  it('migrates legacy usernames and keeps their password valid', async () => {
    sessionCookie = ''

    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username: 'legacy_api_user@fura.info',
        password: 'legacy-pass-1',
      },
    })
    const payload = (await response.json()) as { profile: { username: string; displayName: string } }

    expect(response.status).toBe(200)
    expect(payload.profile.username).toBe('legacy_api_user@fura.info')
    expect(payload.profile.displayName).toBe('Legacy API User')
  })

  it('accepts the Fura-domain alias for an existing Gmail account', async () => {
    const stamp = Date.now()
    const gmailUsername = `bigdaddysatan_${stamp}@gmail.com`
    const furaUsername = `bigdaddysatan_${stamp}@fura.info`

    const register = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: gmailUsername,
        displayName: 'Big Daddy Satan',
        password: 'legacy-pass-2',
      },
    })

    expect(register.status).toBe(200)

    const login = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username: furaUsername,
        password: 'legacy-pass-2',
      },
    })
    const payload = (await login.json()) as { profile: { username: string; displayName: string } }

    expect(login.status).toBe(200)
    expect(payload.profile.username).toBe(furaUsername)
    expect(payload.profile.displayName).toBe('Big Daddy Satan')
  })

  it('rejects registration without an email identifier', async () => {
    sessionCookie = ''

    const response = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'legacy-user',
        displayName: 'Legacy User',
        password: 'secret123',
      },
    })

    expect(response.status).toBe(400)
  })

  it('rejects reset-password without active session', async () => {
    sessionCookie = ''

    const response = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        username: 'someone@example.com',
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

  it('permanently deletes the active profile and invalidates its session', async () => {
    sessionCookie = ''
    const stamp = Date.now()

    const keepResponse = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: `keep_${stamp}@example.com`,
        displayName: 'Keep User',
        password: 'secret123',
      },
    })
    const keepPayload = (await keepResponse.json()) as { profile: { id: string } }

    expect(keepResponse.status).toBe(200)

    const deleteResponse = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: `delete_${stamp}@example.com`,
        displayName: 'Delete User',
        password: 'secret123',
      },
    })
    const deletePayload = (await deleteResponse.json()) as { profile: { id: string } }

    expect(deleteResponse.status).toBe(200)

    const response = await apiRequest('/api/auth/delete-account', {
      method: 'POST',
      body: {
        profileId: deletePayload.profile.id,
        confirm: true,
      },
    })

    expect(response.status).toBe(200)

    const sessionResponse = await apiRequest('/api/auth/session')
    const sessionPayload = (await sessionResponse.json()) as { profileId: string | null }
    expect(sessionPayload.profileId).toBeNull()

    const storedState = JSON.parse(await readFile(path.join(tempDir, 'auth-db.json'), 'utf8')) as {
      profiles: Array<{ id: string }>
      credentials: Array<{ profileId: string }>
    }

    expect(storedState.profiles.some((profile) => profile.id === deletePayload.profile.id)).toBe(false)
    expect(storedState.credentials.some((credential) => credential.profileId === deletePayload.profile.id)).toBe(false)

    const keepLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username: `keep_${stamp}@example.com`,
        password: 'secret123',
      },
    })
    const keepLoginPayload = (await keepLogin.json()) as { profile: { id: string } }

    expect(keepLogin.status).toBe(200)
    expect(keepLoginPayload.profile.id).toBe(keepPayload.profile.id)
  })
})
