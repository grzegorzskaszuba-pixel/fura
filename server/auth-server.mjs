import http from 'node:http'
import { URL } from 'node:url'
import crypto from 'node:crypto'

import {
  changePassword,
  getSessionProfileId,
  loginProfile,
  registerProfile,
  resetPassword,
} from './auth-core.mjs'
import { StorageError, readState, writeState } from './storage.mjs'

const PORT = Number(process.env.AUTH_API_PORT ?? process.env.PORT ?? 8787)
const HOST = process.env.AUTH_API_HOST ?? '0.0.0.0'
const SESSION_COOKIE = 'fura_session'
const COOKIE_SAME_SITE = String(process.env.AUTH_COOKIE_SAME_SITE ?? 'Lax')
const COOKIE_SECURE =
  String(process.env.AUTH_COOKIE_SECURE ?? '').trim().toLowerCase() === 'true' ||
  COOKIE_SAME_SITE.toLowerCase() === 'none' ||
  process.env.RENDER === 'true'
const ALLOWED_ORIGINS = String(process.env.AUTH_API_ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)
const sessions = new Map()
const startedAt = new Date().toISOString()

function isInputError(error) {
  if (!(error instanceof Error)) {
    return false
  }

  const normalized = error.message
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

  return (
    normalized.includes('podaj ') ||
    normalized.includes('nieprawidlow') ||
    normalized.includes('nie znaleziono ') ||
    normalized.includes('taki profil juz istnieje') ||
    normalized.includes('profil nie istnieje') ||
    normalized.includes('brak ') ||
    normalized.includes('musi miec co najmniej') ||
    normalized.includes('nie istnieje')
  )
}

function mapErrorToResponse(error) {
  if (error instanceof StorageError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    }
  }

  if (isInputError(error)) {
    return {
      statusCode: 400,
      message: error.message,
    }
  }

  return {
    statusCode: 500,
    message: 'Wystapil nieoczekiwany blad serwera. Sprobuj ponownie za chwile.',
  }
}

function getAllowedOrigin(requestOrigin) {
  if (!requestOrigin) {
    return null
  }

  if (ALLOWED_ORIGINS.includes('*')) {
    return requestOrigin
  }

  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null
}

function setCorsHeaders(request, response) {
  const requestOrigin = request.headers.origin
  const allowedOrigin = getAllowedOrigin(requestOrigin)

  if (!allowedOrigin) {
    return
  }

  response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  response.setHeader('Vary', 'Origin')
}

function setJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function readCookies(request) {
  const header = request.headers.cookie

  if (!header) {
    return {}
  }

  return Object.fromEntries(
    header.split(';').map((chunk) => {
      const [rawName, ...rest] = chunk.trim().split('=')
      return [rawName, decodeURIComponent(rest.join('='))]
    }),
  )
}

function setSessionCookie(response, sessionId) {
  const secureAttr = COOKIE_SECURE ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=${COOKIE_SAME_SITE}; Path=/; Max-Age=604800${secureAttr}`,
  )
}

function clearSessionCookie(response) {
  const secureAttr = COOKIE_SECURE ? '; Secure' : ''
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=${COOKIE_SAME_SITE}; Path=/; Max-Age=0${secureAttr}`)
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8')

  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Nieprawidłowy format JSON')
  }
}

function createSession(profileId) {
  const sessionId = crypto.randomUUID()
  sessions.set(sessionId, profileId)
  return sessionId
}

function invalidateProfileSessions(profileId) {
  for (const [sessionId, activeProfileId] of sessions.entries()) {
    if (activeProfileId === profileId) {
      sessions.delete(sessionId)
    }
  }
}

function readBearerSessionId(request) {
  const authHeader = request.headers.authorization

  if (typeof authHeader !== 'string') {
    return null
  }

  const trimmed = authHeader.trim()

  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return null
  }

  const token = trimmed.slice(7).trim()
  return token.length > 0 ? token : null
}

function getRequestSessionId(request) {
  const bearerSessionId = readBearerSessionId(request)

  if (bearerSessionId) {
    return bearerSessionId
  }

  const cookies = readCookies(request)
  return cookies[SESSION_COOKIE] ?? null
}

function getAuthenticatedProfileId(request) {
  return getSessionProfileId(sessions, getRequestSessionId(request))
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeOptionalNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }

  return value
}

function sanitizeProfile(profile) {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }
}

function sanitizeVehiclePayload(payload) {
  const normalizedName = String(payload.name ?? '').trim()
  const normalizedMake = String(payload.make ?? '').trim()
  const normalizedModel = String(payload.model ?? '').trim()

  if (normalizedName.length < 2) {
    throw new Error('Podaj nazwę auta')
  }

  if (normalizedMake.length < 2) {
    throw new Error('Podaj markę')
  }

  if (normalizedModel.length < 1) {
    throw new Error('Podaj model')
  }

  return {
    name: normalizedName,
    make: normalizedMake,
    model: normalizedModel,
    year: payload.year,
    bodyType: normalizeOptionalString(payload.bodyType),
    fuelType: normalizeOptionalString(payload.fuelType),
    transmission: normalizeOptionalString(payload.transmission),
    engine: normalizeOptionalString(payload.engine),
    power: normalizeOptionalNumber(payload.power),
    color: normalizeOptionalString(payload.color),
    vin: normalizeOptionalString(payload.vin),
    registrationNumber: normalizeOptionalString(payload.registrationNumber),
    currentMileage: normalizeOptionalNumber(payload.currentMileage),
    imageUrl: normalizeOptionalString(payload.imageUrl),
    notes: normalizeOptionalString(payload.notes),
    archived: Boolean(payload.archived),
  }
}

function sanitizeServiceEventPayload(payload) {
  const validStatuses = new Set(['completed', 'planned', 'cancelled'])
  const validStatus = String(payload.status ?? '').trim()
  const title = String(payload.title ?? '').trim()
  const category = String(payload.category ?? '').trim()
  const vehicleId = String(payload.vehicleId ?? '').trim()

  if (!validStatuses.has(validStatus)) {
    throw new Error('Nieprawidlowy status wpisu')
  }

  if (title.length < 2) {
    throw new Error('Podaj tytul wpisu')
  }

  if (category.length < 1) {
    throw new Error('Podaj kategorie wpisu')
  }

  return {
    vehicleId,
    status: validStatus,
    category,
    title,
    eventDate: normalizeOptionalString(payload.eventDate),
    mileage: normalizeOptionalNumber(payload.mileage),
    description: normalizeOptionalString(payload.description),
    workshopName: normalizeOptionalString(payload.workshopName),
    partsCost: normalizeOptionalNumber(payload.partsCost),
    laborCost: normalizeOptionalNumber(payload.laborCost),
    otherCost: normalizeOptionalNumber(payload.otherCost),
    attachmentCount: normalizeOptionalNumber(payload.attachmentCount),
    attachmentNames: Array.isArray(payload.attachmentNames) ? payload.attachmentNames.filter((name) => typeof name === 'string') : undefined,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : undefined,
    isRecurring: typeof payload.isRecurring === 'boolean' ? payload.isRecurring : undefined,
    recurrenceType: payload.recurrenceType === 'time' || payload.recurrenceType === 'mileage' ? payload.recurrenceType : undefined,
    recurrenceIntervalValue: normalizeOptionalNumber(payload.recurrenceIntervalValue),
    recurrenceIntervalUnit:
      payload.recurrenceIntervalUnit === 'days' || payload.recurrenceIntervalUnit === 'weeks' || payload.recurrenceIntervalUnit === 'months' || payload.recurrenceIntervalUnit === 'years'
        ? payload.recurrenceIntervalUnit
        : undefined,
    recurrenceMileageInterval: normalizeOptionalNumber(payload.recurrenceMileageInterval),
  }
}

async function handleAuthRequest(request, response) {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const pathname = requestUrl.pathname
  const method = request.method ?? 'GET'

  if (pathname === '/api/health' && method === 'GET') {
    setJson(response, 200, {
      ok: true,
      service: 'auth-api',
      startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
      sessions: sessions.size,
    })
    return
  }

  if (pathname === '/api/auth/session' && method === 'GET') {
    const profileId = getSessionProfileId(sessions, getRequestSessionId(request))
    setJson(response, 200, { profileId })
    return
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const sessionId = getRequestSessionId(request)
    const profileId = getSessionProfileId(sessions, sessionId)

    if (profileId) {
      invalidateProfileSessions(profileId)
    } else if (sessionId) {
      sessions.delete(sessionId)
    }

    clearSessionCookie(response)
    setJson(response, 200, { ok: true })
    return
  }

  if (pathname === '/api/vehicles' && method === 'GET') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const state = await readState()
    const vehicles = state.vehicles
      .filter((vehicle) => vehicle.profileId === profileId && !vehicle.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    setJson(response, 200, { vehicles })
    return
  }

  if (pathname === '/api/profiles' && method === 'GET') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 200, { profiles: [] })
      return
    }

    const state = await readState()
    const currentProfile = state.profiles.find((profile) => profile.id === profileId)

    if (!currentProfile) {
      setJson(response, 401, { message: 'Brak aktywnej sesji profilu' })
      return
    }

    setJson(response, 200, { profiles: [sanitizeProfile(currentProfile)] })
    return
  }

  if (pathname.startsWith('/api/profiles/') && method === 'PUT') {
    const sessionProfileId = getAuthenticatedProfileId(request)

    if (!sessionProfileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const profileId = pathname.slice('/api/profiles/'.length)

    if (sessionProfileId !== profileId) {
      setJson(response, 403, { message: 'Brak dostępu do wskazanego profilu' })
      return
    }

    const payload = await readJsonBody(request)
    const displayName = String(payload.displayName ?? '').trim()

    if (displayName.length < 2) {
      setJson(response, 400, { message: 'Nazwa wyświetlana musi mieć co najmniej 2 znaki' })
      return
    }

    const state = await readState()
    const profile = state.profiles.find((entry) => entry.id === profileId)

    if (!profile) {
      setJson(response, 404, { message: 'Profil nie istnieje' })
      return
    }

    profile.displayName = displayName
    profile.updatedAt = new Date().toISOString()

    await writeState(state)
    setJson(response, 200, { profile: sanitizeProfile(profile) })
    return
  }

  if (pathname === '/api/vehicles' && method === 'POST') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const state = await readState()
    const payload = await readJsonBody(request)
    const now = new Date().toISOString()
    const normalized = sanitizeVehiclePayload(payload)
    const vehicle = {
      id: crypto.randomUUID(),
      profileId,
      ...normalized,
      createdAt: now,
      updatedAt: now,
    }

    state.vehicles.push(vehicle)
    await writeState(state)
    setJson(response, 200, { vehicle })
    return
  }

  if (pathname.startsWith('/api/vehicles/') && method === 'PUT') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const state = await readState()
    const vehicleId = pathname.slice('/api/vehicles/'.length)
    const vehicle = state.vehicles.find((entry) => entry.id === vehicleId)

    if (!vehicle || vehicle.profileId !== profileId) {
      setJson(response, 404, { message: 'Vehicle not found' })
      return
    }

    const payload = await readJsonBody(request)
    const normalized = sanitizeVehiclePayload(payload)

    Object.assign(vehicle, normalized, { updatedAt: new Date().toISOString() })
    await writeState(state)
    setJson(response, 200, { vehicle })
    return
  }

  if (pathname.startsWith('/api/vehicles/') && method === 'DELETE') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const state = await readState()
    const vehicleId = pathname.slice('/api/vehicles/'.length)
    const existing = state.vehicles.find((entry) => entry.id === vehicleId)

    if (!existing || existing.profileId !== profileId) {
      setJson(response, 404, { message: 'Vehicle not found' })
      return
    }

    state.vehicles = state.vehicles.filter((entry) => entry.id !== vehicleId)
    state.serviceEvents = state.serviceEvents.filter((entry) => entry.vehicleId !== vehicleId)
    await writeState(state)
    setJson(response, 200, { ok: true })
    return
  }

  if (pathname === '/api/service-events' && method === 'GET') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const vehicleId = String(requestUrl.searchParams.get('vehicleId') ?? '').trim()

    if (!vehicleId) {
      setJson(response, 400, { message: 'Brak vehicleId' })
      return
    }

    const state = await readState()
    const vehicle = state.vehicles.find((entry) => entry.id === vehicleId)

    if (!vehicle || vehicle.profileId !== profileId) {
      setJson(response, 404, { message: 'Vehicle not found' })
      return
    }

    const events = state.serviceEvents
      .filter((event) => event.profileId === profileId && event.vehicleId === vehicleId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    setJson(response, 200, { events })
    return
  }

  if (pathname.startsWith('/api/service-events/') && method === 'GET') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const state = await readState()
    const eventId = pathname.slice('/api/service-events/'.length)
    const event = state.serviceEvents.find((entry) => entry.id === eventId)

    if (!event || event.profileId !== profileId) {
      setJson(response, 404, { message: 'Service event not found' })
      return
    }

    setJson(response, 200, { event })
    return
  }

  if (pathname === '/api/service-events' && method === 'POST') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const state = await readState()
    const payload = await readJsonBody(request)
    const normalized = sanitizeServiceEventPayload(payload)

    if (!normalized.vehicleId) {
      setJson(response, 400, { message: 'Brak vehicleId' })
      return
    }

    const vehicle = state.vehicles.find((entry) => entry.id === normalized.vehicleId)

    if (!vehicle || vehicle.profileId !== profileId) {
      setJson(response, 404, { message: 'Vehicle not found' })
      return
    }

    const now = new Date().toISOString()
    const event = {
      id: crypto.randomUUID(),
      profileId,
      vehicleId: normalized.vehicleId,
      status: normalized.status,
      category: normalized.category,
      title: normalized.title,
      eventDate: normalized.eventDate,
      mileage: normalized.mileage,
      description: normalized.description,
      workshopName: normalized.workshopName,
      partsCost: normalized.partsCost,
      laborCost: normalized.laborCost,
      otherCost: normalized.otherCost,
      currency: 'PLN',
      attachmentCount: normalized.attachmentCount,
      attachmentNames: normalized.attachmentNames,
      attachments: normalized.attachments,
      isRecurring: normalized.isRecurring,
      recurrenceType: normalized.recurrenceType,
      recurrenceIntervalValue: normalized.recurrenceIntervalValue,
      recurrenceIntervalUnit: normalized.recurrenceIntervalUnit,
      recurrenceMileageInterval: normalized.recurrenceMileageInterval,
      createdAt: now,
      updatedAt: now,
    }

    state.serviceEvents.push(event)
    await writeState(state)
    setJson(response, 200, { event })
    return
  }

  if (pathname.startsWith('/api/service-events/') && method === 'PUT') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const state = await readState()
    const eventId = pathname.slice('/api/service-events/'.length)
    const event = state.serviceEvents.find((entry) => entry.id === eventId)

    if (!event || event.profileId !== profileId) {
      setJson(response, 404, { message: 'Service event not found' })
      return
    }

    const payload = await readJsonBody(request)
    const normalized = sanitizeServiceEventPayload({ ...payload, vehicleId: event.vehicleId })

    Object.assign(event, {
      status: normalized.status,
      category: normalized.category,
      title: normalized.title,
      eventDate: normalized.eventDate,
      mileage: normalized.mileage,
      description: normalized.description,
      workshopName: normalized.workshopName,
      partsCost: normalized.partsCost,
      laborCost: normalized.laborCost,
      otherCost: normalized.otherCost,
      attachmentCount: normalized.attachmentCount,
      attachmentNames: normalized.attachmentNames,
      attachments: normalized.attachments,
      isRecurring: normalized.isRecurring,
      recurrenceType: normalized.recurrenceType,
      recurrenceIntervalValue: normalized.recurrenceIntervalValue,
      recurrenceIntervalUnit: normalized.recurrenceIntervalUnit,
      recurrenceMileageInterval: normalized.recurrenceMileageInterval,
      updatedAt: new Date().toISOString(),
      currency: 'PLN',
    })

    await writeState(state)
    setJson(response, 200, { event })
    return
  }

  if (pathname.startsWith('/api/service-events/') && method === 'DELETE') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const state = await readState()
    const eventId = pathname.slice('/api/service-events/'.length)
    const existing = state.serviceEvents.find((entry) => entry.id === eventId)

    if (!existing || existing.profileId !== profileId) {
      setJson(response, 404, { message: 'Service event not found' })
      return
    }

    state.serviceEvents = state.serviceEvents.filter((entry) => entry.id !== eventId)
    await writeState(state)
    setJson(response, 200, { ok: true })
    return
  }

  const state = await readState()

  if (pathname === '/api/auth/register' && method === 'POST') {
    const payload = await readJsonBody(request)
    const profile = registerProfile(state, payload)
    await writeState(state)

    const sessionId = createSession(profile.id)
    setSessionCookie(response, sessionId)
    setJson(response, 200, { profile, sessionId })
    return
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const payload = await readJsonBody(request)
    const profile = loginProfile(state, payload)
    await writeState(state)

    const sessionId = createSession(profile.id)
    setSessionCookie(response, sessionId)
    setJson(response, 200, { profile, sessionId })
    return
  }

  if (pathname === '/api/auth/reset-password' && method === 'POST') {
    const sessionProfileId = getSessionProfileId(sessions, getRequestSessionId(request))

    if (!sessionProfileId) {
      setJson(response, 403, { message: 'Brak aktywnej sesji profilu' })
      return
    }

    const payload = await readJsonBody(request)
    const payloadUsername = String(payload.username ?? '').trim().toLowerCase()
    const credential = state.credentials.find((entry) => entry.profileId === sessionProfileId)

    if (!credential || credential.username !== payloadUsername) {
      setJson(response, 403, { message: 'Brak aktywnej sesji profilu' })
      return
    }

    resetPassword(state, payload)

    await writeState(state)
    setJson(response, 200, { ok: true })
    return
  }

  if (pathname === '/api/auth/change-password' && method === 'POST') {
    const payload = await readJsonBody(request)
    const sessionProfileId = getSessionProfileId(sessions, getRequestSessionId(request))

    if (!sessionProfileId || sessionProfileId !== payload.profileId) {
      setJson(response, 403, { message: 'Brak aktywnej sesji profilu' })
      return
    }

    changePassword(state, payload)
    await writeState(state)
    setJson(response, 200, { ok: true })
    return
  }

  setJson(response, 404, { message: 'Not found' })
}

const server = http.createServer(async (request, response) => {
  setCorsHeaders(request, response)

  if ((request.method ?? 'GET') === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  try {
    await handleAuthRequest(request, response)
  } catch (error) {
    const mapped = mapErrorToResponse(error)
    if (mapped.statusCode >= 500) {
      const cause = error instanceof StorageError ? error.cause : undefined
      // eslint-disable-next-line no-console
      console.error('[auth-api] request failed', {
        method: request.method,
        url: request.url,
        statusCode: mapped.statusCode,
        message: mapped.message,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: typeof error?.code === 'string' ? error.code : undefined,
        causeMessage: cause instanceof Error ? cause.message : undefined,
        causeCode: typeof cause?.code === 'string' ? cause.code : undefined,
      })
    }
    setJson(response, mapped.statusCode, { message: mapped.message })
  }
})

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[auth-api] listening on http://${HOST}:${PORT}`)
})
