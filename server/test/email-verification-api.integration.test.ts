// @vitest-environment node

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { hashEmailVerificationToken } from '../email-verification.mjs'

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

describe('email verification API integration', () => {
  let apiProcess: ChildProcessWithoutNullStreams | null = null
  let baseUrl = ''
  let tempDir = ''

  async function apiRequest(pathname: string, body: unknown) {
    return fetch(`${baseUrl}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'carlog-email-verification-'))
    const dbFile = path.join(tempDir, 'auth-db.json')
    const profileId = 'verification-profile'
    const token = 'verification-token'
    const salt = 'verification-salt'
    const pendingProfileId = 'pending-profile'
    const pendingToken = 'pending-token'
    const pendingSalt = 'pending-salt'
    const port = await findFreePort()
    baseUrl = `http://127.0.0.1:${port}`

    await writeFile(
      dbFile,
      JSON.stringify({
        profiles: [
          {
            id: profileId,
            username: 'verification@example.com',
            displayName: 'Verification User',
            createdAt: '2026-09-18T00:00:00.000Z',
            updatedAt: '2026-09-18T00:00:00.000Z',
            emailVerifiedAt: null,
          },
        ],
        credentials: [
          {
            profileId,
            username: 'verification@example.com',
            passwordHash: crypto.scryptSync('secret123', salt, 64).toString('hex'),
            passwordSalt: salt,
            createdAt: '2026-09-18T00:00:00.000Z',
            updatedAt: '2026-09-18T00:00:00.000Z',
          },
        ],
        vehicles: [],
        serviceEvents: [],
        shareBrochures: [],
        emailVerificationTokens: [
          {
            id: 'verification-token-record',
            profileId,
            tokenHash: hashEmailVerificationToken(token),
            expiresAt: '2026-09-19T00:00:00.000Z',
            createdAt: '2026-09-18T00:00:00.000Z',
            usedAt: null,
          },
        ],
        pendingEmailRegistrations: [
          {
            id: pendingProfileId,
            username: 'pending@example.com',
            displayName: 'Pending User',
            passwordHash: crypto.scryptSync('secret123', pendingSalt, 64).toString('hex'),
            passwordSalt: pendingSalt,
            tokenHash: hashEmailVerificationToken(pendingToken),
            expiresAt: '2026-09-19T00:00:00.000Z',
            createdAt: '2026-09-18T00:00:00.000Z',
            usedAt: null,
          },
        ],
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
        AUTH_EMAIL_VERIFICATION_ENABLED: 'true',
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

  it('blocks login until the token is verified and rejects reuse', async () => {
    const blockedLogin = await apiRequest('/api/auth/login', {
      username: 'verification@example.com',
      password: 'secret123',
    })

    expect(blockedLogin.status).toBe(403)

    const verification = await apiRequest('/api/auth/verify-email', { token: 'verification-token' })
    expect(verification.status).toBe(200)

    const reusedVerification = await apiRequest('/api/auth/verify-email', { token: 'verification-token' })
    expect(reusedVerification.status).toBe(400)

    const login = await apiRequest('/api/auth/login', {
      username: 'verification@example.com',
      password: 'secret123',
    })

    expect(login.status).toBe(200)
  })

  it('promotes a pending registration only after the token is verified', async () => {
    const blockedLogin = await apiRequest('/api/auth/login', {
      username: 'pending@example.com',
      password: 'secret123',
    })

    expect(blockedLogin.status).toBe(403)

    const verification = await apiRequest('/api/auth/verify-email', { token: 'pending-token' })
    expect(verification.status).toBe(200)

    const login = await apiRequest('/api/auth/login', {
      username: 'pending@example.com',
      password: 'secret123',
    })

    expect(login.status).toBe(200)
  })

  it('does not persist a profile when the verification email cannot be sent', async () => {
    const username = `email-failure-${Date.now()}@example.com`
    const register = await apiRequest('/api/auth/register', {
      username,
      displayName: 'Email Failure',
      password: 'secret123',
    })

    expect(register.status).toBe(500)

    const login = await apiRequest('/api/auth/login', {
      username,
      password: 'secret123',
    })

    expect(login.status).toBe(400)
  })
})