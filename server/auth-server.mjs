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
import { StorageError, isPostgresStorage, postgresQuery, postgresTransaction, readState, writeState } from './storage.mjs'

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

function normalizeNumber(value) {
  if (value === null || value === undefined) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function mapProfileRow(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapVehicleRow(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    make: row.make,
    model: row.model,
    year: normalizeNumber(row.year),
    bodyType: row.body_type ?? undefined,
    fuelType: row.fuel_type ?? undefined,
    transmission: row.transmission ?? undefined,
    engine: row.engine ?? undefined,
    power: normalizeNumber(row.power),
    color: row.color ?? undefined,
    vin: row.vin ?? undefined,
    registrationNumber: row.registration_number ?? undefined,
    currentMileage: normalizeNumber(row.current_mileage),
    imageUrl: row.image_url ?? undefined,
    notes: row.notes ?? undefined,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapServiceEventRow(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    vehicleId: row.vehicle_id,
    status: row.status,
    category: row.category,
    title: row.title,
    eventDate: row.event_date ?? undefined,
    mileage: normalizeNumber(row.mileage),
    description: row.description ?? undefined,
    workshopName: row.workshop_name ?? undefined,
    partsCost: normalizeNumber(row.parts_cost),
    laborCost: normalizeNumber(row.labor_cost),
    otherCost: normalizeNumber(row.other_cost),
    currency: row.currency,
    attachmentCount: normalizeNumber(row.attachment_count),
    attachmentNames: Array.isArray(row.attachment_names) ? row.attachment_names : undefined,
    attachments: Array.isArray(row.attachments) ? row.attachments : undefined,
    isRecurring: typeof row.is_recurring === 'boolean' ? row.is_recurring : undefined,
    recurrenceType: row.recurrence_type ?? undefined,
    recurrenceIntervalValue: normalizeNumber(row.recurrence_interval_value),
    recurrenceIntervalUnit: row.recurrence_interval_unit ?? undefined,
    recurrenceMileageInterval: normalizeNumber(row.recurrence_mileage_interval),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

    if (isPostgresStorage()) {
      const result = await postgresQuery('SELECT * FROM vehicles WHERE profile_id = $1 AND archived = FALSE ORDER BY updated_at DESC', [profileId])
      setJson(response, 200, { vehicles: result.rows.map(mapVehicleRow) })
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

    if (isPostgresStorage()) {
      const result = await postgresQuery(
        'SELECT id, username, display_name, created_at, updated_at FROM profiles WHERE id = $1 LIMIT 1',
        [profileId],
      )

      const currentProfileRow = result.rows[0]

      if (!currentProfileRow) {
        setJson(response, 401, { message: 'Brak aktywnej sesji profilu' })
        return
      }

      setJson(response, 200, { profiles: [mapProfileRow(currentProfileRow)] })
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

    if (isPostgresStorage()) {
      const updatedAt = new Date().toISOString()
      const result = await postgresQuery(
        `
          UPDATE profiles
          SET display_name = $1, updated_at = $2
          WHERE id = $3
          RETURNING id, username, display_name, created_at, updated_at
        `,
        [displayName, updatedAt, profileId],
      )

      const row = result.rows[0]

      if (!row) {
        setJson(response, 404, { message: 'Profil nie istnieje' })
        return
      }

      setJson(response, 200, { profile: mapProfileRow(row) })
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

    if (isPostgresStorage()) {
      const result = await postgresQuery(
        `
          INSERT INTO vehicles (
            id, profile_id, name, make, model, year, body_type, fuel_type, transmission,
            engine, power, color, vin, registration_number, current_mileage, image_url,
            notes, archived, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20
          )
          RETURNING *
        `,
        [
          vehicle.id,
          vehicle.profileId,
          vehicle.name,
          vehicle.make,
          vehicle.model,
          vehicle.year ?? null,
          vehicle.bodyType ?? null,
          vehicle.fuelType ?? null,
          vehicle.transmission ?? null,
          vehicle.engine ?? null,
          vehicle.power ?? null,
          vehicle.color ?? null,
          vehicle.vin ?? null,
          vehicle.registrationNumber ?? null,
          vehicle.currentMileage ?? null,
          vehicle.imageUrl ?? null,
          vehicle.notes ?? null,
          Boolean(vehicle.archived),
          vehicle.createdAt,
          vehicle.updatedAt,
        ],
      )

      setJson(response, 200, { vehicle: mapVehicleRow(result.rows[0]) })
      return
    }

    const state = await readState()

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

    const vehicleId = pathname.slice('/api/vehicles/'.length)
    const payload = await readJsonBody(request)
    const normalized = sanitizeVehiclePayload(payload)

    if (isPostgresStorage()) {
      const updatedAt = new Date().toISOString()
      const result = await postgresQuery(
        `
          UPDATE vehicles
          SET
            name = $1,
            make = $2,
            model = $3,
            year = $4,
            body_type = $5,
            fuel_type = $6,
            transmission = $7,
            engine = $8,
            power = $9,
            color = $10,
            vin = $11,
            registration_number = $12,
            current_mileage = $13,
            image_url = $14,
            notes = $15,
            archived = $16,
            updated_at = $17
          WHERE id = $18 AND profile_id = $19
          RETURNING *
        `,
        [
          normalized.name,
          normalized.make,
          normalized.model,
          normalized.year ?? null,
          normalized.bodyType ?? null,
          normalized.fuelType ?? null,
          normalized.transmission ?? null,
          normalized.engine ?? null,
          normalized.power ?? null,
          normalized.color ?? null,
          normalized.vin ?? null,
          normalized.registrationNumber ?? null,
          normalized.currentMileage ?? null,
          normalized.imageUrl ?? null,
          normalized.notes ?? null,
          Boolean(normalized.archived),
          updatedAt,
          vehicleId,
          profileId,
        ],
      )

      const row = result.rows[0]

      if (!row) {
        setJson(response, 404, { message: 'Vehicle not found' })
        return
      }

      setJson(response, 200, { vehicle: mapVehicleRow(row) })
      return
    }

    const state = await readState()
    const vehicle = state.vehicles.find((entry) => entry.id === vehicleId)

    if (!vehicle || vehicle.profileId !== profileId) {
      setJson(response, 404, { message: 'Vehicle not found' })
      return
    }

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

    const vehicleId = pathname.slice('/api/vehicles/'.length)

    if (isPostgresStorage()) {
      const result = await postgresQuery('DELETE FROM vehicles WHERE id = $1 AND profile_id = $2 RETURNING id', [vehicleId, profileId])

      if (!result.rows[0]) {
        setJson(response, 404, { message: 'Vehicle not found' })
        return
      }

      setJson(response, 200, { ok: true })
      return
    }

    const state = await readState()
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

    if (isPostgresStorage()) {
      const vehicleResult = await postgresQuery('SELECT id FROM vehicles WHERE id = $1 AND profile_id = $2 LIMIT 1', [vehicleId, profileId])

      if (!vehicleResult.rows[0]) {
        setJson(response, 404, { message: 'Vehicle not found' })
        return
      }

      const eventsResult = await postgresQuery(
        'SELECT * FROM service_events WHERE profile_id = $1 AND vehicle_id = $2 ORDER BY updated_at DESC',
        [profileId, vehicleId],
      )

      setJson(response, 200, { events: eventsResult.rows.map(mapServiceEventRow) })
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

    const eventId = pathname.slice('/api/service-events/'.length)

    if (isPostgresStorage()) {
      const result = await postgresQuery('SELECT * FROM service_events WHERE id = $1 AND profile_id = $2 LIMIT 1', [eventId, profileId])
      const row = result.rows[0]

      if (!row) {
        setJson(response, 404, { message: 'Service event not found' })
        return
      }

      setJson(response, 200, { event: mapServiceEventRow(row) })
      return
    }

    const state = await readState()
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

    const payload = await readJsonBody(request)
    const normalized = sanitizeServiceEventPayload(payload)

    if (!normalized.vehicleId) {
      setJson(response, 400, { message: 'Brak vehicleId' })
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

    if (isPostgresStorage()) {
      const vehicleResult = await postgresQuery('SELECT id FROM vehicles WHERE id = $1 AND profile_id = $2 LIMIT 1', [normalized.vehicleId, profileId])

      if (!vehicleResult.rows[0]) {
        setJson(response, 404, { message: 'Vehicle not found' })
        return
      }

      const inserted = await postgresQuery(
        `
          INSERT INTO service_events (
            id, profile_id, vehicle_id, status, category, title, event_date, mileage, description,
            workshop_name, parts_cost, labor_cost, other_cost, currency, attachment_count,
            attachment_names, attachments, is_recurring, recurrence_type, recurrence_interval_value,
            recurrence_interval_unit, recurrence_mileage_interval, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15,
            $16::jsonb, $17::jsonb, $18, $19, $20,
            $21, $22, $23, $24
          )
          RETURNING *
        `,
        [
          event.id,
          event.profileId,
          event.vehicleId,
          event.status,
          event.category,
          event.title,
          event.eventDate ?? null,
          event.mileage ?? null,
          event.description ?? null,
          event.workshopName ?? null,
          event.partsCost ?? null,
          event.laborCost ?? null,
          event.otherCost ?? null,
          event.currency,
          event.attachmentCount ?? null,
          event.attachmentNames ? JSON.stringify(event.attachmentNames) : null,
          event.attachments ? JSON.stringify(event.attachments) : null,
          event.isRecurring ?? null,
          event.recurrenceType ?? null,
          event.recurrenceIntervalValue ?? null,
          event.recurrenceIntervalUnit ?? null,
          event.recurrenceMileageInterval ?? null,
          event.createdAt,
          event.updatedAt,
        ],
      )

      setJson(response, 200, { event: mapServiceEventRow(inserted.rows[0]) })
      return
    }

    const state = await readState()
    const vehicle = state.vehicles.find((entry) => entry.id === normalized.vehicleId)

    if (!vehicle || vehicle.profileId !== profileId) {
      setJson(response, 404, { message: 'Vehicle not found' })
      return
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

    const eventId = pathname.slice('/api/service-events/'.length)
    const payload = await readJsonBody(request)

    if (isPostgresStorage()) {
      const existingResult = await postgresQuery('SELECT * FROM service_events WHERE id = $1 AND profile_id = $2 LIMIT 1', [eventId, profileId])
      const existingRow = existingResult.rows[0]

      if (!existingRow) {
        setJson(response, 404, { message: 'Service event not found' })
        return
      }

      const normalized = sanitizeServiceEventPayload({ ...payload, vehicleId: existingRow.vehicle_id })
      const updatedAt = new Date().toISOString()
      const updatedResult = await postgresQuery(
        `
          UPDATE service_events
          SET
            status = $1,
            category = $2,
            title = $3,
            event_date = $4,
            mileage = $5,
            description = $6,
            workshop_name = $7,
            parts_cost = $8,
            labor_cost = $9,
            other_cost = $10,
            attachment_count = $11,
            attachment_names = $12::jsonb,
            attachments = $13::jsonb,
            is_recurring = $14,
            recurrence_type = $15,
            recurrence_interval_value = $16,
            recurrence_interval_unit = $17,
            recurrence_mileage_interval = $18,
            updated_at = $19,
            currency = 'PLN'
          WHERE id = $20 AND profile_id = $21
          RETURNING *
        `,
        [
          normalized.status,
          normalized.category,
          normalized.title,
          normalized.eventDate ?? null,
          normalized.mileage ?? null,
          normalized.description ?? null,
          normalized.workshopName ?? null,
          normalized.partsCost ?? null,
          normalized.laborCost ?? null,
          normalized.otherCost ?? null,
          normalized.attachmentCount ?? null,
          normalized.attachmentNames ? JSON.stringify(normalized.attachmentNames) : null,
          normalized.attachments ? JSON.stringify(normalized.attachments) : null,
          normalized.isRecurring ?? null,
          normalized.recurrenceType ?? null,
          normalized.recurrenceIntervalValue ?? null,
          normalized.recurrenceIntervalUnit ?? null,
          normalized.recurrenceMileageInterval ?? null,
          updatedAt,
          eventId,
          profileId,
        ],
      )

      setJson(response, 200, { event: mapServiceEventRow(updatedResult.rows[0]) })
      return
    }

    const state = await readState()
    const event = state.serviceEvents.find((entry) => entry.id === eventId)

    if (!event || event.profileId !== profileId) {
      setJson(response, 404, { message: 'Service event not found' })
      return
    }

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

    const eventId = pathname.slice('/api/service-events/'.length)

    if (isPostgresStorage()) {
      const result = await postgresQuery('DELETE FROM service_events WHERE id = $1 AND profile_id = $2 RETURNING id', [eventId, profileId])

      if (!result.rows[0]) {
        setJson(response, 404, { message: 'Service event not found' })
        return
      }

      setJson(response, 200, { ok: true })
      return
    }

    const state = await readState()
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

  if (pathname === '/api/auth/register' && method === 'POST') {
    const payload = await readJsonBody(request)

    if (isPostgresStorage()) {
      const username = String(payload.username ?? '').trim().toLowerCase()
      const password = String(payload.password ?? '')

      if (username.length < 2) {
        setJson(response, 400, { message: 'Podaj nazwę użytkownika' })
        return
      }

      if (password.length < 6) {
        setJson(response, 400, { message: 'Hasło musi mieć co najmniej 6 znaków' })
        return
      }

      const existing = await postgresQuery('SELECT id FROM profiles WHERE username = $1 LIMIT 1', [username])

      if (existing.rows[0]) {
        setJson(response, 400, { message: 'Taki profil już istnieje' })
        return
      }

      const localState = { profiles: [], credentials: [], vehicles: [], serviceEvents: [] }
      const profile = registerProfile(localState, payload)
      const credential = localState.credentials[0]

      await postgresTransaction(async (client) => {
        await client.query(
          'INSERT INTO profiles (id, username, display_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
          [profile.id, profile.username, profile.displayName, profile.createdAt, profile.updatedAt],
        )
        await client.query(
          'INSERT INTO credentials (profile_id, username, password_hash, password_salt, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
          [credential.profileId, credential.username, credential.passwordHash, credential.passwordSalt, credential.createdAt, credential.updatedAt],
        )
      })

      const sessionId = createSession(profile.id)
      setSessionCookie(response, sessionId)
      setJson(response, 200, { profile, sessionId })
      return
    }

    const state = await readState()
    const profile = registerProfile(state, payload)
    await writeState(state)

    const sessionId = createSession(profile.id)
    setSessionCookie(response, sessionId)
    setJson(response, 200, { profile, sessionId })
    return
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const payload = await readJsonBody(request)

    if (isPostgresStorage()) {
      const username = String(payload.username ?? '').trim().toLowerCase()
      const profileResult = await postgresQuery(
        `
          SELECT
            p.id,
            p.username,
            p.display_name,
            p.created_at,
            p.updated_at,
            c.profile_id,
            c.password_hash,
            c.password_salt,
            c.created_at AS credential_created_at,
            c.updated_at AS credential_updated_at
          FROM profiles p
          JOIN credentials c ON c.profile_id = p.id
          WHERE p.username = $1
          LIMIT 1
        `,
        [username],
      )

      const row = profileResult.rows[0]

      if (!row) {
        setJson(response, 400, { message: 'Nie znaleziono profilu o podanej nazwie użytkownika' })
        return
      }

      const localState = {
        profiles: [
          {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
        ],
        credentials: [
          {
            profileId: row.profile_id,
            username: row.username,
            passwordHash: row.password_hash,
            passwordSalt: row.password_salt,
            createdAt: row.credential_created_at,
            updatedAt: row.credential_updated_at,
          },
        ],
        vehicles: [],
        serviceEvents: [],
      }

      const profile = loginProfile(localState, payload)
      const updatedProfile = localState.profiles[0]
      const updatedCredential = localState.credentials[0]

      await postgresTransaction(async (client) => {
        await client.query('UPDATE profiles SET updated_at = $1 WHERE id = $2', [updatedProfile.updatedAt, updatedProfile.id])
        await client.query('UPDATE credentials SET updated_at = $1 WHERE profile_id = $2', [updatedCredential.updatedAt, updatedCredential.profileId])
      })

      const sessionId = createSession(profile.id)
      setSessionCookie(response, sessionId)
      setJson(response, 200, { profile, sessionId })
      return
    }

    const state = await readState()
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

    if (isPostgresStorage()) {
      const credentialResult = await postgresQuery('SELECT username FROM credentials WHERE profile_id = $1 LIMIT 1', [sessionProfileId])
      const credential = credentialResult.rows[0]

      if (!credential || credential.username !== payloadUsername) {
        setJson(response, 403, { message: 'Brak aktywnej sesji profilu' })
        return
      }

      const profileRow = await postgresQuery(
        `
          SELECT
            p.id,
            p.username,
            p.display_name,
            p.created_at,
            p.updated_at,
            c.profile_id,
            c.password_hash,
            c.password_salt,
            c.created_at AS credential_created_at,
            c.updated_at AS credential_updated_at
          FROM profiles p
          JOIN credentials c ON c.profile_id = p.id
          WHERE p.id = $1
          LIMIT 1
        `,
        [sessionProfileId],
      )

      const row = profileRow.rows[0]

      if (!row) {
        setJson(response, 403, { message: 'Brak aktywnej sesji profilu' })
        return
      }

      const localState = {
        profiles: [
          {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
        ],
        credentials: [
          {
            profileId: row.profile_id,
            username: row.username,
            passwordHash: row.password_hash,
            passwordSalt: row.password_salt,
            createdAt: row.credential_created_at,
            updatedAt: row.credential_updated_at,
          },
        ],
        vehicles: [],
        serviceEvents: [],
      }

      resetPassword(localState, payload)
      const updatedCredential = localState.credentials[0]

      await postgresQuery('UPDATE credentials SET password_hash = $1, password_salt = $2, updated_at = $3 WHERE profile_id = $4', [
        updatedCredential.passwordHash,
        updatedCredential.passwordSalt,
        updatedCredential.updatedAt,
        updatedCredential.profileId,
      ])

      setJson(response, 200, { ok: true })
      return
    }

    const state = await readState()
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

    if (isPostgresStorage()) {
      const profileRow = await postgresQuery(
        `
          SELECT
            p.id,
            p.username,
            p.display_name,
            p.created_at,
            p.updated_at,
            c.profile_id,
            c.password_hash,
            c.password_salt,
            c.created_at AS credential_created_at,
            c.updated_at AS credential_updated_at
          FROM profiles p
          JOIN credentials c ON c.profile_id = p.id
          WHERE p.id = $1
          LIMIT 1
        `,
        [sessionProfileId],
      )

      const row = profileRow.rows[0]

      if (!row) {
        setJson(response, 403, { message: 'Brak aktywnej sesji profilu' })
        return
      }

      const localState = {
        profiles: [
          {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
        ],
        credentials: [
          {
            profileId: row.profile_id,
            username: row.username,
            passwordHash: row.password_hash,
            passwordSalt: row.password_salt,
            createdAt: row.credential_created_at,
            updatedAt: row.credential_updated_at,
          },
        ],
        vehicles: [],
        serviceEvents: [],
      }

      changePassword(localState, payload)
      const updatedCredential = localState.credentials[0]

      await postgresQuery('UPDATE credentials SET password_hash = $1, password_salt = $2, updated_at = $3 WHERE profile_id = $4', [
        updatedCredential.passwordHash,
        updatedCredential.passwordSalt,
        updatedCredential.updatedAt,
        updatedCredential.profileId,
      ])

      setJson(response, 200, { ok: true })
      return
    }

    const state = await readState()
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
