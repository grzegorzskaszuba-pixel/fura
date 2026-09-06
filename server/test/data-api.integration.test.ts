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

interface ApiCallOptions {
  method?: string
  body?: unknown
  cookie?: string
}

describe('data API integration', () => {
  let apiProcess: ChildProcessWithoutNullStreams | null = null
  let baseUrl = ''
  let tempDir = ''

  async function apiRequest(pathname: string, options?: ApiCallOptions) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (options?.cookie) {
      headers.cookie = options.cookie
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    })

    const setCookieHeader = response.headers.get('set-cookie')
    const nextCookie = setCookieHeader ? (setCookieHeader.split(';', 1)[0] ?? '') : undefined

    return { response, nextCookie }
  }

  async function registerAndGetCookie(username: string) {
    const { response, nextCookie } = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username,
        displayName: username,
        password: 'secret123',
      },
    })

    expect(response.status).toBe(200)
    expect(nextCookie).toBeTruthy()

    return nextCookie as string
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'carlog-data-api-'))
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

  it('rejects unauthenticated vehicles access', async () => {
    const { response } = await apiRequest('/api/vehicles')

    expect(response.status).toBe(401)
  })

  it('returns only vehicles for active profile session', async () => {
    const stamp = Date.now()
    const cookieA = await registerAndGetCookie(`vehicle_a_${stamp}`)
    const cookieB = await registerAndGetCookie(`vehicle_b_${stamp}`)

    const createA = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie: cookieA,
      body: {
        name: 'BMW 320d',
        make: 'BMW',
        model: '320d',
      },
    })

    const createB = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie: cookieB,
      body: {
        name: 'Audi Q5',
        make: 'Audi',
        model: 'Q5',
      },
    })

    expect(createA.response.status).toBe(200)
    expect(createB.response.status).toBe(200)

    const vehicleA = (await createA.response.json()) as { vehicle: { id: string } }
    const vehicleB = (await createB.response.json()) as { vehicle: { id: string } }

    const listA = await apiRequest('/api/vehicles', { cookie: cookieA })
    const payloadA = (await listA.response.json()) as { vehicles: Array<{ id: string }> }

    expect(listA.response.status).toBe(200)
    expect(payloadA.vehicles.map((vehicle) => vehicle.id)).toContain(vehicleA.vehicle.id)
    expect(payloadA.vehicles.map((vehicle) => vehicle.id)).not.toContain(vehicleB.vehicle.id)

    const listB = await apiRequest('/api/vehicles', { cookie: cookieB })
    const payloadB = (await listB.response.json()) as { vehicles: Array<{ id: string }> }

    expect(listB.response.status).toBe(200)
    expect(payloadB.vehicles.map((vehicle) => vehicle.id)).toContain(vehicleB.vehicle.id)
    expect(payloadB.vehicles.map((vehicle) => vehicle.id)).not.toContain(vehicleA.vehicle.id)
  })

  it('blocks creating service event on other profile vehicle', async () => {
    const stamp = Date.now()
    const cookieA = await registerAndGetCookie(`event_a_${stamp}`)
    const cookieB = await registerAndGetCookie(`event_b_${stamp}`)

    const createVehicleB = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie: cookieB,
      body: {
        name: 'Seat Leon',
        make: 'Seat',
        model: 'Leon',
      },
    })

    expect(createVehicleB.response.status).toBe(200)
    const vehicleB = (await createVehicleB.response.json()) as { vehicle: { id: string } }

    const createEventAsA = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie: cookieA,
      body: {
        vehicleId: vehicleB.vehicle.id,
        status: 'planned',
        category: 'inspection',
        title: 'Przeglad',
      },
    })

    expect(createEventAsA.response.status).toBe(404)
  })

  it('blocks deleting service event from another profile', async () => {
    const stamp = Date.now()
    const cookieA = await registerAndGetCookie(`delete_a_${stamp}`)
    const cookieB = await registerAndGetCookie(`delete_b_${stamp}`)

    const createVehicleA = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie: cookieA,
      body: {
        name: 'Ford Focus',
        make: 'Ford',
        model: 'Focus',
      },
    })

    expect(createVehicleA.response.status).toBe(200)
    const vehicleA = (await createVehicleA.response.json()) as { vehicle: { id: string } }

    const createEventA = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie: cookieA,
      body: {
        vehicleId: vehicleA.vehicle.id,
        status: 'completed',
        category: 'repair',
        title: 'Wymiana filtra',
      },
    })

    expect(createEventA.response.status).toBe(200)
    const eventA = (await createEventA.response.json()) as { event: { id: string } }

    const deleteAsB = await apiRequest(`/api/service-events/${eventA.event.id}`, {
      method: 'DELETE',
      cookie: cookieB,
    })

    expect(deleteAsB.response.status).toBe(404)

    const listAsA = await apiRequest(`/api/service-events?vehicleId=${vehicleA.vehicle.id}`, {
      cookie: cookieA,
    })
    const payloadA = (await listAsA.response.json()) as { events: Array<{ id: string }> }

    expect(listAsA.response.status).toBe(200)
    expect(payloadA.events.map((event) => event.id)).toContain(eventA.event.id)
  })
})
