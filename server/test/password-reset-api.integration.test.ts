// @vitest-environment node

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createPasswordResetToken } from '../password-reset.mjs'

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

describe('password reset API integration', () => {
  let apiProcess: ChildProcessWithoutNullStreams | null = null
  let baseUrl = ''
  let tempDir = ''
  let resetToken = ''

  async function apiRequest(pathname: string, body?: unknown, cookie?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (cookie) {
      headers.cookie = cookie
    }

    return fetch(`${baseUrl}${pathname}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'carlog-password-reset-'))
    const dbFile = path.join(tempDir, 'auth-db.json')
    const profileId = 'password-reset-profile'
    const salt = 'password-reset-salt'
    const passwordReset = createPasswordResetToken(profileId)
    resetToken = passwordReset.token
    const port = await findFreePort()
    baseUrl = `http://127.0.0.1:${port}`

    await writeFile(
      dbFile,
      JSON.stringify({
        profiles: [
          {
            id: profileId,
            username: 'reset@example.com',
            displayName: 'Reset User',
            createdAt: '2026-09-18T00:00:00.000Z',
            updatedAt: '2026-09-18T00:00:00.000Z',
            emailVerifiedAt: '2026-09-18T00:00:00.000Z',
          },
          {
            id: 'password-reset-neutral-profile',
            username: 'neutral@example.com',
            displayName: 'Neutral User',
            createdAt: '2026-09-18T00:00:00.000Z',
            updatedAt: '2026-09-18T00:00:00.000Z',
            emailVerifiedAt: '2026-09-18T00:00:00.000Z',
          },
        ],
        credentials: [
          {
            profileId,
            username: 'reset@example.com',
            passwordHash: crypto.scryptSync('old-pass-1', salt, 64).toString('hex'),
            passwordSalt: salt,
            createdAt: '2026-09-18T00:00:00.000Z',
            updatedAt: '2026-09-18T00:00:00.000Z',
          },
        ],
        vehicles: [],
        serviceEvents: [],
        passwordResetTokens: [passwordReset.record],
      }),
      'utf8',
    )

    apiProcess = spawn(process.execPath, ['server/auth-server.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUTH_API_PORT: String(port),
        AUTH_API_HOST: '127.0.0.1',
        AUTH_DB_FILE: dbFile,
        AUTH_EMAIL_VERIFICATION_ENABLED: 'false',
        RESEND_API_KEY: '',
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

  it('returns a neutral response for known and unknown addresses', async () => {
    const unknown = await apiRequest('/api/auth/password-reset/request', { username: 'unknown@example.com' })
    const known = await apiRequest('/api/auth/password-reset/request', { username: 'neutral@example.com' })

    expect(unknown.status).toBe(200)
    expect(known.status).toBe(200)
    expect(await unknown.json()).toEqual({ ok: true })
    expect(await known.json()).toEqual({ ok: true })
  })

  it('changes the password once, invalidates sessions, and rejects token reuse', async () => {
    const login = await apiRequest('/api/auth/login', { username: 'reset@example.com', password: 'old-pass-1' })
    const sessionCookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(login.status).toBe(200)
    expect(sessionCookie).toBeTruthy()

    const reset = await apiRequest('/api/auth/password-reset/confirm', { token: resetToken, password: 'new-pass-1' })
    expect(reset.status).toBe(200)

    const invalidatedSession = await apiRequest('/api/auth/session', undefined, sessionCookie)
    const invalidatedPayload = (await invalidatedSession.json()) as { profileId: string | null }
    expect(invalidatedPayload.profileId).toBeNull()

    const reused = await apiRequest('/api/auth/password-reset/confirm', { token: resetToken, password: 'new-pass-2' })
    expect(reused.status).toBe(400)

    const oldPasswordLogin = await apiRequest('/api/auth/login', { username: 'reset@example.com', password: 'old-pass-1' })
    expect(oldPasswordLogin.status).toBe(400)

    const newPasswordLogin = await apiRequest('/api/auth/login', { username: 'reset@example.com', password: 'new-pass-1' })
    expect(newPasswordLogin.status).toBe(200)
  })
})