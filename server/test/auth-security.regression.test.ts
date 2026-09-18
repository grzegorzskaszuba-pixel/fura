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

describe('Auth security regression', () => {
  let apiProcess: ChildProcessWithoutNullStreams | null = null
  let baseUrl = ''
  let tempDir = ''
  let sessionCookie = ''

  async function apiRequest(pathname: string, options?: { method?: string; body?: unknown; cookie?: string }) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (options?.cookie) {
      headers.cookie = options.cookie
    } else if (sessionCookie) {
      headers.cookie = sessionCookie
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    })

    const setCookie = response.headers.get('set-cookie')

    if (setCookie && !options?.cookie) {
      sessionCookie = setCookie.split(';', 1)[0] ?? ''
    }

    return response
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'carlog-auth-security-'))
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
        AUTH_EMAIL_VERIFICATION_ENABLED: 'false',
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

  it('rejects password reset when username does not belong to active session profile', async () => {
    const stamp = Date.now()
    const userA = `secure_a_${stamp}@example.com`
    const userB = `secure_b_${stamp}@example.com`

    const registerA = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: userA,
        displayName: 'Secure A',
        password: 'old-pass-a',
      },
    })

    expect(registerA.status).toBe(200)

    const registerB = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: userB,
        displayName: 'Secure B',
        password: 'old-pass-b',
      },
    })

    expect(registerB.status).toBe(200)

    const forbiddenReset = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        username: userA,
        password: 'new-pass-a',
      },
    })

    expect(forbiddenReset.status).toBe(403)

    const loginWithOldPassword = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username: userA,
        password: 'old-pass-a',
      },
    })

    expect(loginWithOldPassword.status).toBe(200)

    const loginWithNewPassword = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username: userA,
        password: 'new-pass-a',
      },
    })

    expect(loginWithNewPassword.status).toBe(400)
  })

  it('keeps switch-profile endpoint unavailable', async () => {
    const response = await apiRequest('/api/auth/switch-profile', {
      method: 'POST',
      body: {
        profileId: 'legacy-switch-attempt',
      },
    })

    expect(response.status).toBe(404)
  })

  it('logs out profile from all active sessions', async () => {
    const stamp = Date.now()
    const username = `logout_all_${stamp}@example.com`

    const register = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username,
        displayName: 'Logout All',
        password: 'logout-pass-1',
      },
    })
    const firstSessionCookie = register.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(register.status).toBe(200)
    expect(firstSessionCookie).toBeTruthy()

    const loginSecondSession = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username,
        password: 'logout-pass-1',
      },
    })
    const secondSessionCookie = loginSecondSession.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(loginSecondSession.status).toBe(200)
    expect(secondSessionCookie).toBeTruthy()
    expect(secondSessionCookie).not.toBe(firstSessionCookie)

    const sessionBeforeLogout = await apiRequest('/api/auth/session', {
      cookie: secondSessionCookie,
    })
    const beforePayload = (await sessionBeforeLogout.json()) as { profileId: string | null }

    expect(sessionBeforeLogout.status).toBe(200)
    expect(beforePayload.profileId).toBeTruthy()

    const logoutFromFirstSession = await apiRequest('/api/auth/logout', {
      method: 'POST',
      cookie: firstSessionCookie,
    })

    expect(logoutFromFirstSession.status).toBe(200)

    const sessionAfterLogout = await apiRequest('/api/auth/session', {
      cookie: secondSessionCookie,
    })
    const afterPayload = (await sessionAfterLogout.json()) as { profileId: string | null }

    expect(sessionAfterLogout.status).toBe(200)
    expect(afterPayload.profileId).toBeNull()

    const protectedRequestAfterLogout = await apiRequest('/api/vehicles', {
      cookie: secondSessionCookie,
    })

    expect(protectedRequestAfterLogout.status).toBe(401)
  })

  it('rejects updating vehicle from another profile session', async () => {
    const stamp = Date.now()
    const userA = `vehicle_owner_${stamp}@example.com`
    const userB = `vehicle_intruder_${stamp}@example.com`

    const registerA = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: userA,
        displayName: 'Vehicle Owner',
        password: 'owner-pass-1',
      },
    })
    const cookieA = registerA.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(registerA.status).toBe(200)
    expect(cookieA).toBeTruthy()

    const registerB = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: userB,
        displayName: 'Vehicle Intruder',
        password: 'intruder-pass-1',
      },
    })
    const cookieB = registerB.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(registerB.status).toBe(200)
    expect(cookieB).toBeTruthy()

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie: cookieA,
      body: {
        name: 'Mazda 6',
        make: 'Mazda',
        model: '6',
      },
    })
    const createdVehiclePayload = (await createVehicle.json()) as { vehicle: { id: string } }

    expect(createVehicle.status).toBe(200)

    const updateAsIntruder = await apiRequest(`/api/vehicles/${createdVehiclePayload.vehicle.id}`, {
      method: 'PUT',
      cookie: cookieB,
      body: {
        name: 'Hijacked Mazda',
        make: 'Mazda',
        model: '6',
      },
    })

    expect(updateAsIntruder.status).toBe(404)

    const listOwnerVehicles = await apiRequest('/api/vehicles', {
      cookie: cookieA,
    })
    const ownerVehiclesPayload = (await listOwnerVehicles.json()) as { vehicles: Array<{ id: string; name: string }> }

    expect(listOwnerVehicles.status).toBe(200)
    expect(ownerVehiclesPayload.vehicles.some((vehicle) => vehicle.id === createdVehiclePayload.vehicle.id && vehicle.name === 'Mazda 6')).toBe(true)
  })

  it('rejects updating service event from another profile session', async () => {
    const stamp = Date.now()
    const userA = `event_owner_${stamp}@example.com`
    const userB = `event_intruder_${stamp}@example.com`

    const registerA = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: userA,
        displayName: 'Event Owner',
        password: 'owner-pass-2',
      },
    })
    const cookieA = registerA.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(registerA.status).toBe(200)
    expect(cookieA).toBeTruthy()

    const registerB = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: userB,
        displayName: 'Event Intruder',
        password: 'intruder-pass-2',
      },
    })
    const cookieB = registerB.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(registerB.status).toBe(200)
    expect(cookieB).toBeTruthy()

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie: cookieA,
      body: {
        name: 'Toyota Corolla',
        make: 'Toyota',
        model: 'Corolla',
      },
    })
    const createdVehiclePayload = (await createVehicle.json()) as { vehicle: { id: string } }

    expect(createVehicle.status).toBe(200)

    const createEvent = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie: cookieA,
      body: {
        vehicleId: createdVehiclePayload.vehicle.id,
        status: 'planned',
        category: 'inspection',
        title: 'Przeglad okresowy',
      },
    })
    const createdEventPayload = (await createEvent.json()) as { event: { id: string } }

    expect(createEvent.status).toBe(200)

    const updateAsIntruder = await apiRequest(`/api/service-events/${createdEventPayload.event.id}`, {
      method: 'PUT',
      cookie: cookieB,
      body: {
        status: 'completed',
        category: 'repair',
        title: 'Unauthorized overwrite',
      },
    })

    expect(updateAsIntruder.status).toBe(404)

    const listOwnerEvents = await apiRequest(`/api/service-events?vehicleId=${createdVehiclePayload.vehicle.id}`, {
      cookie: cookieA,
    })
    const ownerEventsPayload = (await listOwnerEvents.json()) as { events: Array<{ id: string; title: string; status: string }> }

    expect(listOwnerEvents.status).toBe(200)
    expect(ownerEventsPayload.events.some((event) => event.id === createdEventPayload.event.id && event.title === 'Przeglad okresowy' && event.status === 'planned')).toBe(true)
  })

  it('does not allow moving event to another vehicle by payload tampering', async () => {
    const stamp = Date.now()
    const user = `event_tamper_${stamp}@example.com`

    const register = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: user,
        displayName: 'Tamper Test',
        password: 'tamper-pass-1',
      },
    })
    const cookie = register.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(register.status).toBe(200)
    expect(cookie).toBeTruthy()

    const createVehicleA = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie,
      body: {
        name: 'Honda Civic',
        make: 'Honda',
        model: 'Civic',
      },
    })
    const vehicleA = (await createVehicleA.json()) as { vehicle: { id: string } }

    const createVehicleB = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie,
      body: {
        name: 'Kia Ceed',
        make: 'Kia',
        model: 'Ceed',
      },
    })
    const vehicleB = (await createVehicleB.json()) as { vehicle: { id: string } }

    const createEvent = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicleA.vehicle.id,
        status: 'planned',
        category: 'inspection',
        title: 'Event bound to first vehicle',
      },
    })
    const createdEventPayload = (await createEvent.json()) as { event: { id: string } }

    expect(createEvent.status).toBe(200)

    const tamperedUpdate = await apiRequest(`/api/service-events/${createdEventPayload.event.id}`, {
      method: 'PUT',
      cookie,
      body: {
        vehicleId: vehicleB.vehicle.id,
        status: 'planned',
        category: 'inspection',
        title: 'Tampered event title',
      },
    })

    expect(tamperedUpdate.status).toBe(200)

    const listVehicleA = await apiRequest(`/api/service-events?vehicleId=${vehicleA.vehicle.id}`, {
      cookie,
    })
    const eventsA = (await listVehicleA.json()) as { events: Array<{ id: string; title: string }> }

    const listVehicleB = await apiRequest(`/api/service-events?vehicleId=${vehicleB.vehicle.id}`, {
      cookie,
    })
    const eventsB = (await listVehicleB.json()) as { events: Array<{ id: string }> }

    expect(listVehicleA.status).toBe(200)
    expect(listVehicleB.status).toBe(200)
    expect(eventsA.events.some((event) => event.id === createdEventPayload.event.id && event.title === 'Tampered event title')).toBe(true)
    expect(eventsB.events.some((event) => event.id === createdEventPayload.event.id)).toBe(false)
  })

  it('rejects service event update with invalid status', async () => {
    const stamp = Date.now()
    const user = `event_status_${stamp}@example.com`

    const register = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: user,
        displayName: 'Status Test',
        password: 'status-pass-1',
      },
    })
    const cookie = register.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

    expect(register.status).toBe(200)
    expect(cookie).toBeTruthy()

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie,
      body: {
        name: 'Opel Astra',
        make: 'Opel',
        model: 'Astra',
      },
    })
    const vehicle = (await createVehicle.json()) as { vehicle: { id: string } }

    const createEvent = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicle.vehicle.id,
        status: 'planned',
        category: 'inspection',
        title: 'Status should stay valid',
      },
    })
    const createdEventPayload = (await createEvent.json()) as { event: { id: string } }

    expect(createEvent.status).toBe(200)

    const invalidUpdate = await apiRequest(`/api/service-events/${createdEventPayload.event.id}`, {
      method: 'PUT',
      cookie,
      body: {
        status: 'broken-status',
        category: 'inspection',
        title: 'Should fail',
      },
    })

    expect(invalidUpdate.status).toBe(400)

    const listEvents = await apiRequest(`/api/service-events?vehicleId=${vehicle.vehicle.id}`, {
      cookie,
    })
    const eventsPayload = (await listEvents.json()) as { events: Array<{ id: string; status: string; title: string }> }

    expect(listEvents.status).toBe(200)
    expect(eventsPayload.events.some((event) => event.id === createdEventPayload.event.id && event.status === 'planned' && event.title === 'Status should stay valid')).toBe(true)
  })
})
