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
    const email = username.includes('@') ? username : `${username}@example.com`
    const { response, nextCookie } = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: email,
        displayName: username,
        password: 'secret123',
        termsAccepted: true,
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

  it('deletes own vehicle and removes related service events', async () => {
    const stamp = Date.now()
    const cookie = await registerAndGetCookie(`vehicle_delete_${stamp}`)

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie,
      body: {
        name: 'Honda Civic',
        make: 'Honda',
        model: 'Civic',
      },
    })

    expect(createVehicle.response.status).toBe(200)
    const vehicle = (await createVehicle.response.json()) as { vehicle: { id: string } }

    const createEvent = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicle.vehicle.id,
        status: 'completed',
        category: 'repair',
        title: 'Wymiana oleju',
      },
    })

    expect(createEvent.response.status).toBe(200)

    const deleteVehicle = await apiRequest(`/api/vehicles/${vehicle.vehicle.id}`, {
      method: 'DELETE',
      cookie,
    })

    expect(deleteVehicle.response.status).toBe(200)

    const listVehicles = await apiRequest('/api/vehicles', { cookie })
    const vehiclesPayload = (await listVehicles.response.json()) as { vehicles: Array<{ id: string }> }
    expect(listVehicles.response.status).toBe(200)
    expect(vehiclesPayload.vehicles.map((entry) => entry.id)).not.toContain(vehicle.vehicle.id)

    const listEvents = await apiRequest(`/api/service-events?vehicleId=${vehicle.vehicle.id}`, { cookie })
    expect(listEvents.response.status).toBe(404)
  })

  it('does not include attachment previews in vehicle history responses', async () => {
    const stamp = Date.now()
    const cookie = await registerAndGetCookie(`history_attachments_${stamp}`)

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie,
      body: {
        name: 'Volvo V60',
        make: 'Volvo',
        model: 'V60',
      },
    })

    expect(createVehicle.response.status).toBe(200)
    const vehicle = (await createVehicle.response.json()) as { vehicle: { id: string } }
    const previewUrl = `data:image/jpeg;base64,${'a'.repeat(2_000_000)}`

    const createEvent = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicle.vehicle.id,
        status: 'completed',
        category: 'repair',
        title: 'Wymiana tarcz',
        attachments: [{ id: 'attachment-1', name: 'tarcze.jpg', mimeType: 'image/jpeg', previewUrl }],
      },
    })

    expect(createEvent.response.status).toBe(200)
    const createdEvent = (await createEvent.response.json()) as { event: { id: string } }

    const listEvents = await apiRequest(`/api/service-events?vehicleId=${vehicle.vehicle.id}`, { cookie })
    const payload = (await listEvents.response.json()) as {
      events: Array<{ attachmentCount?: number; attachmentNames?: string[]; attachments?: unknown[] }>
    }

    expect(listEvents.response.status).toBe(200)
    expect(payload.events).toHaveLength(1)
    expect(payload.events[0]?.attachmentCount).toBe(1)
    expect(payload.events[0]?.attachmentNames).toEqual(['tarcze.jpg'])
    expect(payload.events[0]?.attachments).toBeUndefined()

    const detailResponse = await apiRequest(`/api/service-events/${createdEvent.event.id}`, { cookie })
    const detailPayload = (await detailResponse.response.json()) as { event: { attachments?: Array<{ previewUrl?: string }> } }

    expect(detailResponse.response.status).toBe(200)
    expect(detailPayload.event.attachments?.[0]?.previewUrl).toBe(previewUrl)
  })

  it('enforces attachment count and decoded content size limits', async () => {
    const stamp = Date.now()
    const cookie = await registerAndGetCookie(`attachment_limits_${stamp}`)

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie,
      body: {
        name: 'Toyota Corolla',
        make: 'Toyota',
        model: 'Corolla',
      },
    })

    expect(createVehicle.response.status).toBe(200)
    const vehicle = (await createVehicle.response.json()) as { vehicle: { id: string } }
    const allowedAttachments = Array.from({ length: 5 }, (_, index) => ({
      id: `allowed-${index}`,
      name: `plik-${index}.pdf`,
      mimeType: 'application/pdf',
    }))

    const allowedResponse = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicle.vehicle.id,
        status: 'completed',
        category: 'documents',
        title: 'Pięć załączników',
        attachments: allowedAttachments,
      },
    })

    expect(allowedResponse.response.status).toBe(200)

    const tooManyResponse = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicle.vehicle.id,
        status: 'completed',
        category: 'documents',
        title: 'Sześć załączników',
        attachments: [...allowedAttachments, { id: 'too-many', name: 'plik-5.pdf', mimeType: 'application/pdf' }],
      },
    })

    expect(tooManyResponse.response.status).toBe(400)

    const oversizedPayloadLength = Math.ceil((20 * 1024 * 1024 + 1) / 3) * 4
    const oversizedResponse = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicle.vehicle.id,
        status: 'completed',
        category: 'documents',
        title: 'Za duży załącznik',
        attachments: [
          {
            id: 'oversized',
            name: 'duzy.bin',
            mimeType: 'application/octet-stream',
            contentUrl: `data:application/octet-stream;base64,${'a'.repeat(oversizedPayloadLength)}`,
          },
        ],
      },
    })

    expect(oversizedResponse.response.status).toBe(400)
  })

  it('creates 6h public share brochure link for own vehicle', async () => {
    const stamp = Date.now()
    const cookie = await registerAndGetCookie(`share_ok_${stamp}`)

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie,
      body: {
        name: 'Skoda Octavia',
        make: 'Skoda',
        model: 'Octavia',
      },
    })

    expect(createVehicle.response.status).toBe(200)
    const vehicle = (await createVehicle.response.json()) as { vehicle: { id: string; name: string } }

    const createEvent = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicle.vehicle.id,
        status: 'completed',
        category: 'repair',
        title: 'Wymiana rozrzadu',
      },
    })

    expect(createEvent.response.status).toBe(200)

    const shareResponse = await apiRequest('/api/share-brochures', {
      method: 'POST',
      cookie,
      body: {
        vehicleId: vehicle.vehicle.id,
      },
    })

    expect(shareResponse.response.status).toBe(200)
    const sharePayload = (await shareResponse.response.json()) as { id: string; expiresAt: string; url: string }
    expect(sharePayload.id.length).toBeGreaterThanOrEqual(40)
    expect(sharePayload.url).toContain(`/api/public-share/${sharePayload.id}`)
    const ttlMs = new Date(sharePayload.expiresAt).getTime() - Date.now()
    expect(ttlMs).toBeGreaterThan(5 * 60 * 60 * 1000)
    expect(ttlMs).toBeLessThanOrEqual(6 * 60 * 60 * 1000)

    const publicResponse = await fetch(sharePayload.url)
    const html = await publicResponse.text()

    expect(publicResponse.status).toBe(200)
    expect(publicResponse.headers.get('content-type')).toContain('text/html')
    expect(html).toContain('Skoda')
    expect(html).toContain('Wymiana rozrzadu')
  })

  it('blocks creating share brochure for vehicle from another profile', async () => {
    const stamp = Date.now()
    const cookieA = await registerAndGetCookie(`share_block_a_${stamp}`)
    const cookieB = await registerAndGetCookie(`share_block_b_${stamp}`)

    const createVehicleB = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie: cookieB,
      body: {
        name: 'Toyota Corolla',
        make: 'Toyota',
        model: 'Corolla',
      },
    })

    expect(createVehicleB.response.status).toBe(200)
    const vehicleB = (await createVehicleB.response.json()) as { vehicle: { id: string } }

    const shareAsA = await apiRequest('/api/share-brochures', {
      method: 'POST',
      cookie: cookieA,
      body: {
        vehicleId: vehicleB.vehicle.id,
      },
    })

    expect(shareAsA.response.status).toBe(404)
  })

  it('returns one active share brochure per vehicle and allows revoking it', async () => {
    const stamp = Date.now()
    const cookie = await registerAndGetCookie(`share_list_${stamp}`)

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie,
      body: {
        name: 'Mazda 3',
        make: 'Mazda',
        model: '3',
      },
    })

    expect(createVehicle.response.status).toBe(200)
    const vehicle = (await createVehicle.response.json()) as { vehicle: { id: string } }

    const share1 = await apiRequest('/api/share-brochures', {
      method: 'POST',
      cookie,
      body: { vehicleId: vehicle.vehicle.id },
    })
    const share2 = await apiRequest('/api/share-brochures', {
      method: 'POST',
      cookie,
      body: { vehicleId: vehicle.vehicle.id },
    })

    expect(share1.response.status).toBe(200)
    expect(share2.response.status).toBe(200)

    const first = (await share1.response.json()) as { id: string; expiresAt: string }
    const second = (await share2.response.json()) as { id: string; expiresAt: string }
    expect(second.id).toBe(first.id)
    expect(second.expiresAt).toBe(first.expiresAt)

    const list = await apiRequest(`/api/share-brochures?vehicleId=${vehicle.vehicle.id}`, { cookie })
    expect(list.response.status).toBe(200)
    const listPayload = (await list.response.json()) as { brochures: Array<{ id: string; url: string }> }
    expect(listPayload.brochures).toHaveLength(1)
    expect(listPayload.brochures[0]?.id).toBe(first.id)

    const revoke = await apiRequest(`/api/share-brochures/${first.id}`, {
      method: 'DELETE',
      cookie,
    })
    expect(revoke.response.status).toBe(200)

    const listAfter = await apiRequest(`/api/share-brochures?vehicleId=${vehicle.vehicle.id}`, { cookie })
    expect(listAfter.response.status).toBe(200)
    const listAfterPayload = (await listAfter.response.json()) as { brochures: Array<{ id: string }> }
    expect(listAfterPayload.brochures).toHaveLength(0)
  })

  it('deletes all remote account-owned vehicle data and share links', async () => {
    const stamp = Date.now()
    const registerA = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: `account_delete_a_${stamp}@example.com`,
        displayName: 'Account Delete A',
        password: 'secret123',
        termsAccepted: true,
      },
    })
    const registerAPayload = (await registerA.response.json()) as { profile: { id: string } }
    const cookieA = registerA.nextCookie as string
    const registerB = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: `account_delete_b_${stamp}@example.com`,
        displayName: 'Account Delete B',
        password: 'secret123',
        termsAccepted: true,
      },
    })
    const cookieB = registerB.nextCookie as string

    const createVehicle = await apiRequest('/api/vehicles', {
      method: 'POST',
      cookie: cookieA,
      body: {
        name: 'Toyota GR Yaris',
        make: 'Toyota',
        model: 'GR Yaris',
      },
    })
    const vehicle = (await createVehicle.response.json()) as { vehicle: { id: string } }

    const createEvent = await apiRequest('/api/service-events', {
      method: 'POST',
      cookie: cookieA,
      body: {
        vehicleId: vehicle.vehicle.id,
        status: 'completed',
        category: 'repair',
        title: 'Wymiana hamulcow',
        attachments: [{ id: 'account-delete-attachment', name: 'rachunek.png', previewUrl: 'data:image/png;base64,ZmFrZQ==' }],
      },
    })
    expect(createEvent.response.status).toBe(200)

    const createShare = await apiRequest('/api/share-brochures', {
      method: 'POST',
      cookie: cookieA,
      body: { vehicleId: vehicle.vehicle.id },
    })
    const sharePayload = (await createShare.response.json()) as { url: string }

    const deleteAccount = await apiRequest('/api/auth/delete-account', {
      method: 'POST',
      cookie: cookieA,
      body: {
        profileId: registerAPayload.profile.id,
        confirm: true,
      },
    })

    expect(deleteAccount.response.status).toBe(200)

    const publicShare = await fetch(sharePayload.url)
    expect(publicShare.status).toBe(404)

    const remainingProfileVehicles = await apiRequest('/api/vehicles', { cookie: cookieB })
    const remainingPayload = (await remainingProfileVehicles.response.json()) as { vehicles: unknown[] }

    expect(remainingProfileVehicles.response.status).toBe(200)
    expect(remainingPayload.vehicles).toHaveLength(0)
  })
})
