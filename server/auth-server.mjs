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
let cachedLegacyState = null
const SHARE_BROCHURE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_SHARED_HISTORY_ITEMS = 30
const MAX_ACTIVE_SHARE_LINKS_PER_VEHICLE = 5

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

function setHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  })
  response.end(html)
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

async function getCachedLegacyState() {
  if (cachedLegacyState) {
    return cachedLegacyState
  }

  cachedLegacyState = await readState()
  return cachedLegacyState
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

function normalizeWorkshopLocation(value) {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const placeId = normalizeOptionalString(value.placeId)
  const label = normalizeOptionalString(value.label)
  const address = normalizeOptionalString(value.address)
  const lat = normalizeOptionalNumber(value.lat)
  const lng = normalizeOptionalNumber(value.lng)

  if (!placeId || !label || lat === undefined || lng === undefined) {
    return undefined
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined
  }

  return {
    placeId,
    label,
    address,
    lat,
    lng,
  }
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

function createShareBrochureId() {
  return crypto.randomBytes(24).toString('hex')
}

function computeEventCost(event) {
  return Number(event.partsCost ?? 0) + Number(event.laborCost ?? 0) + Number(event.otherCost ?? 0)
}

function formatPlCurrency(value) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPlDate(value) {
  if (!value) {
    return 'Bez daty'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Bez daty'
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function formatMileage(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Brak danych'
  }

  return `${new Intl.NumberFormat('pl-PL').format(value)} km`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function mapPublicVehicle(vehicle) {
  return {
    name: vehicle.name,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    currentMileage: vehicle.currentMileage,
  }
}

function mapPublicEvents(events) {
  return events
    .filter((event) => event.status === 'completed')
    .sort((left, right) => {
      const rightDate = right.eventDate ? new Date(right.eventDate).getTime() : 0
      const leftDate = left.eventDate ? new Date(left.eventDate).getTime() : 0

      if (rightDate !== leftDate) {
        return rightDate - leftDate
      }

      return Number(right.mileage ?? 0) - Number(left.mileage ?? 0)
    })
    .slice(0, MAX_SHARED_HISTORY_ITEMS)
    .map((event) => ({
      title: event.title,
      category: event.category,
      eventDate: event.eventDate,
      mileage: event.mileage,
      workshopName: event.workshopName,
      totalCost: computeEventCost(event),
      description: event.description,
    }))
}

function createBrochurePayload(vehicle, events, createdAt, expiresAt) {
  const publicEvents = mapPublicEvents(events)
  const totalCost = publicEvents.reduce((sum, event) => sum + event.totalCost, 0)

  return {
    generatedAt: createdAt,
    expiresAt,
    vehicle: mapPublicVehicle(vehicle),
    summary: {
      eventsCount: publicEvents.length,
      totalCost,
    },
    events: publicEvents,
  }
}

function isExpired(isoString) {
  const timestamp = new Date(isoString).getTime()

  if (Number.isNaN(timestamp)) {
    return true
  }

  return timestamp <= Date.now()
}

function buildPublicShareUrl(request, requestUrl, shareId) {
  const forwardedProtoHeader = typeof request.headers['x-forwarded-proto'] === 'string' ? request.headers['x-forwarded-proto'] : ''
  const forwardedHostHeader = typeof request.headers['x-forwarded-host'] === 'string' ? request.headers['x-forwarded-host'] : ''
  const protocol = (forwardedProtoHeader.split(',')[0] ?? '').trim() || requestUrl.protocol.replace(':', '') || 'http'
  const host = (forwardedHostHeader.split(',')[0] ?? '').trim() || String(request.headers.host ?? '').trim()
  const path = `/api/public-share/${shareId}`

  if (!host) {
    return path
  }

  return `${protocol}://${host}${path}`
}

function toShareBrochureListItem(request, requestUrl, brochure) {
  return {
    id: brochure.id,
    vehicleId: brochure.vehicleId,
    createdAt: brochure.createdAt,
    expiresAt: brochure.expiresAt,
    url: buildPublicShareUrl(request, requestUrl, brochure.id),
  }
}

async function cleanupExpiredShareBrochures() {
  if (isPostgresStorage()) {
    await postgresQuery('DELETE FROM share_brochures WHERE expires_at <= NOW()')
    return
  }

  const state = await readState()
  const nextBrochures = (state.shareBrochures ?? []).filter((entry) => !isExpired(entry.expiresAt))

  if (nextBrochures.length === (state.shareBrochures ?? []).length) {
    return
  }

  state.shareBrochures = nextBrochures
  await writeState(state)
}

function renderShareBrochureHtml(snapshot) {
  const vehicleTitle = [snapshot.vehicle.make, snapshot.vehicle.model].filter(Boolean).join(' ')
  const subtitleParts = [snapshot.vehicle.year, formatMileage(snapshot.vehicle.currentMileage)].filter(Boolean)

  const rows = snapshot.events
    .map((event) => {
      const workshopLine = event.workshopName ? `<p class="muted">Warsztat: ${escapeHtml(event.workshopName)}</p>` : ''
      const descriptionLine = event.description ? `<p class="muted">${escapeHtml(event.description)}</p>` : ''

      return `
        <article class="event-card">
          <div class="event-top">
            <p class="event-title">${escapeHtml(event.title)}</p>
            <p class="event-cost">${escapeHtml(formatPlCurrency(event.totalCost))}</p>
          </div>
          <p class="muted">${escapeHtml(formatPlDate(event.eventDate))} • ${escapeHtml(formatMileage(event.mileage))}</p>
          <p class="chip">${escapeHtml(event.category)}</p>
          ${workshopLine}
          ${descriptionLine}
        </article>
      `
    })
    .join('')

  const emptyState = snapshot.events.length === 0 ? '<p class="empty">Brak wykonanych wpisow serwisowych do udostepnienia.</p>' : rows

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FURA • Historia serwisowa</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f5f4;
        --card: #ffffff;
        --ink: #111827;
        --muted: #52525b;
        --line: #e4e4e7;
        --accent: #ea580c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: radial-gradient(circle at top, #fff7ed 0%, var(--bg) 60%);
        color: var(--ink);
      }
      .wrap {
        max-width: 900px;
        margin: 0 auto;
        padding: 24px 16px 56px;
      }
      .hero {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 20px;
        box-shadow: 0 10px 35px rgba(15, 23, 42, 0.06);
      }
      .badge {
        display: inline-block;
        padding: 6px 10px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border-radius: 999px;
        background: #fff7ed;
        color: var(--accent);
      }
      h1 {
        margin: 12px 0 6px;
        font-size: clamp(24px, 4.8vw, 38px);
        letter-spacing: -0.04em;
      }
      .muted { margin: 4px 0 0; color: var(--muted); }
      .grid {
        margin-top: 14px;
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .stat {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 12px;
        background: #fafafa;
      }
      .stat-label {
        margin: 0;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--muted);
      }
      .stat-value {
        margin: 6px 0 0;
        font-size: 18px;
        font-weight: 600;
        letter-spacing: -0.03em;
      }
      .events {
        margin-top: 18px;
        display: grid;
        gap: 12px;
      }
      .event-card {
        border-radius: 18px;
        border: 1px solid var(--line);
        background: var(--card);
        padding: 14px;
      }
      .event-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }
      .event-title {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .event-cost {
        margin: 0;
        white-space: nowrap;
        color: var(--accent);
        font-weight: 700;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        margin-top: 8px;
        border-radius: 999px;
        background: #f4f4f5;
        color: #3f3f46;
        padding: 5px 10px;
        font-size: 12px;
      }
      .empty {
        border: 1px dashed var(--line);
        border-radius: 18px;
        background: #fff;
        color: var(--muted);
        padding: 18px;
      }
      footer {
        margin-top: 18px;
        color: var(--muted);
        font-size: 12px;
      }
      @media (max-width: 640px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <span class="badge">FURA • Publiczny podglad</span>
        <h1>${escapeHtml(vehicleTitle || snapshot.vehicle.name || 'Pojazd')}</h1>
        <p class="muted">${escapeHtml(snapshot.vehicle.name || '')}</p>
        <p class="muted">${escapeHtml(subtitleParts.filter((part) => String(part).length > 0).join(' • '))}</p>

        <div class="grid">
          <article class="stat">
            <p class="stat-label">Wpisy serwisowe</p>
            <p class="stat-value">${escapeHtml(String(snapshot.summary.eventsCount))}</p>
          </article>
          <article class="stat">
            <p class="stat-label">Suma kosztow</p>
            <p class="stat-value">${escapeHtml(formatPlCurrency(snapshot.summary.totalCost))}</p>
          </article>
        </div>
      </section>

      <section class="events">${emptyState}</section>

      <footer>
        Wygenerowano: ${escapeHtml(formatPlDate(snapshot.generatedAt))}. Link wygasa: ${escapeHtml(formatPlDate(snapshot.expiresAt))}.
      </footer>
    </main>
  </body>
</html>`
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
    workshopLocation: normalizeWorkshopLocation(row.workshop_location),
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
    workshopLocation: normalizeWorkshopLocation(payload.workshopLocation),
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

  if (pathname.startsWith('/api/public-share/') && method === 'GET') {
    await cleanupExpiredShareBrochures()
    const shareId = pathname.slice('/api/public-share/'.length).trim()

    if (!shareId) {
      setHtml(response, 404, '<h1>Not found</h1>')
      return
    }

    if (isPostgresStorage()) {
      const result = await postgresQuery('SELECT payload, expires_at FROM share_brochures WHERE id = $1 LIMIT 1', [shareId])
      const row = result.rows[0]

      if (!row) {
        setHtml(response, 404, '<h1>Ten link nie istnieje lub wygasl.</h1>')
        return
      }

      const expiresAt = row.expires_at

      if (isExpired(expiresAt)) {
        await postgresQuery('DELETE FROM share_brochures WHERE id = $1', [shareId])
        setHtml(response, 410, '<h1>Ten link wygasl.</h1>')
        return
      }

      setHtml(response, 200, renderShareBrochureHtml(row.payload ?? {}))
      return
    }

    const state = await readState()
    const brochure = (state.shareBrochures ?? []).find((entry) => entry.id === shareId)

    if (!brochure) {
      setHtml(response, 404, '<h1>Ten link nie istnieje lub wygasl.</h1>')
      return
    }

    if (isExpired(brochure.expiresAt)) {
      state.shareBrochures = (state.shareBrochures ?? []).filter((entry) => entry.id !== shareId)
      await writeState(state)
      setHtml(response, 410, '<h1>Ten link wygasl.</h1>')
      return
    }

    setHtml(response, 200, renderShareBrochureHtml(brochure.payload ?? {}))
    return
  }

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

  if (pathname === '/api/share-brochures' && method === 'GET') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    await cleanupExpiredShareBrochures()
    const vehicleIdFilter = String(requestUrl.searchParams.get('vehicleId') ?? '').trim()

    if (isPostgresStorage()) {
      if (vehicleIdFilter) {
        const vehicleResult = await postgresQuery('SELECT id FROM vehicles WHERE id = $1 AND profile_id = $2 LIMIT 1', [vehicleIdFilter, profileId])

        if (!vehicleResult.rows[0]) {
          setJson(response, 404, { message: 'Vehicle not found' })
          return
        }
      }

      const result = vehicleIdFilter
        ? await postgresQuery(
            'SELECT id, vehicle_id, created_at, expires_at FROM share_brochures WHERE profile_id = $1 AND vehicle_id = $2 ORDER BY created_at DESC',
            [profileId, vehicleIdFilter],
          )
        : await postgresQuery(
            'SELECT id, vehicle_id, created_at, expires_at FROM share_brochures WHERE profile_id = $1 ORDER BY created_at DESC',
            [profileId],
          )

      const brochures = result.rows.map((row) =>
        toShareBrochureListItem(request, requestUrl, {
          id: row.id,
          vehicleId: row.vehicle_id,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
        }),
      )

      setJson(response, 200, { brochures })
      return
    }

    const state = await readState()
    const ownVehicleIds = new Set(state.vehicles.filter((vehicle) => vehicle.profileId === profileId).map((vehicle) => vehicle.id))

    if (vehicleIdFilter && !ownVehicleIds.has(vehicleIdFilter)) {
      setJson(response, 404, { message: 'Vehicle not found' })
      return
    }

    const brochures = (state.shareBrochures ?? [])
      .filter((entry) => entry.profileId === profileId)
      .filter((entry) => (vehicleIdFilter ? entry.vehicleId === vehicleIdFilter : true))
      .filter((entry) => ownVehicleIds.has(entry.vehicleId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((entry) => toShareBrochureListItem(request, requestUrl, entry))

    setJson(response, 200, { brochures })
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
    state.shareBrochures = (state.shareBrochures ?? []).filter((entry) => entry.vehicleId !== vehicleId)
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

  if (pathname === '/api/share-brochures' && method === 'POST') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const payload = await readJsonBody(request)
    const vehicleId = String(payload.vehicleId ?? '').trim()

    if (!vehicleId) {
      setJson(response, 400, { message: 'Brak vehicleId' })
      return
    }

    await cleanupExpiredShareBrochures()
    const createdAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + SHARE_BROCHURE_TTL_MS).toISOString()
    const id = createShareBrochureId()

    if (isPostgresStorage()) {
      const vehicleResult = await postgresQuery('SELECT * FROM vehicles WHERE id = $1 AND profile_id = $2 LIMIT 1', [vehicleId, profileId])
      const vehicleRow = vehicleResult.rows[0]

      if (!vehicleRow) {
        setJson(response, 404, { message: 'Vehicle not found' })
        return
      }

      const activeCountResult = await postgresQuery(
        'SELECT COUNT(*)::int AS active_count FROM share_brochures WHERE profile_id = $1 AND vehicle_id = $2 AND expires_at > NOW()',
        [profileId, vehicleId],
      )
      const activeCount = Number(activeCountResult.rows[0]?.active_count ?? 0)

      if (activeCount >= MAX_ACTIVE_SHARE_LINKS_PER_VEHICLE) {
        setJson(response, 429, { message: `Mozesz miec maksymalnie ${MAX_ACTIVE_SHARE_LINKS_PER_VEHICLE} aktywnych linkow dla jednego auta.` })
        return
      }

      const eventResult = await postgresQuery(
        'SELECT * FROM service_events WHERE profile_id = $1 AND vehicle_id = $2 AND status = $3 ORDER BY updated_at DESC',
        [profileId, vehicleId, 'completed'],
      )

      const vehicle = mapVehicleRow(vehicleRow)
      const events = eventResult.rows.map(mapServiceEventRow)
      const snapshot = createBrochurePayload(vehicle, events, createdAt, expiresAt)

      await postgresQuery(
        `
          INSERT INTO share_brochures (id, profile_id, vehicle_id, created_at, expires_at, payload)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        `,
        [id, profileId, vehicleId, createdAt, expiresAt, JSON.stringify(snapshot)],
      )

      setJson(response, 200, {
        id,
        expiresAt,
        url: buildPublicShareUrl(request, requestUrl, id),
      })
      return
    }

    const state = await readState()
    const vehicle = state.vehicles.find((entry) => entry.id === vehicleId && entry.profileId === profileId)

    if (!vehicle) {
      setJson(response, 404, { message: 'Vehicle not found' })
      return
    }

    const activeCount = (state.shareBrochures ?? []).filter(
      (entry) => entry.profileId === profileId && entry.vehicleId === vehicleId && !isExpired(entry.expiresAt),
    ).length

    if (activeCount >= MAX_ACTIVE_SHARE_LINKS_PER_VEHICLE) {
      setJson(response, 429, { message: `Mozesz miec maksymalnie ${MAX_ACTIVE_SHARE_LINKS_PER_VEHICLE} aktywnych linkow dla jednego auta.` })
      return
    }

    const vehicleEvents = state.serviceEvents.filter((entry) => entry.profileId === profileId && entry.vehicleId === vehicleId && entry.status === 'completed')
    const snapshot = createBrochurePayload(vehicle, vehicleEvents, createdAt, expiresAt)

    state.shareBrochures = [
      ...((state.shareBrochures ?? []).filter((entry) => !isExpired(entry.expiresAt))),
      {
        id,
        profileId,
        vehicleId,
        createdAt,
        expiresAt,
        payload: snapshot,
      },
    ]

    await writeState(state)

    setJson(response, 200, {
      id,
      expiresAt,
      url: buildPublicShareUrl(request, requestUrl, id),
    })
    return
  }

  if (pathname.startsWith('/api/share-brochures/') && method === 'DELETE') {
    const profileId = getAuthenticatedProfileId(request)

    if (!profileId) {
      setJson(response, 401, { message: 'Brak aktywnej sesji' })
      return
    }

    const brochureId = pathname.slice('/api/share-brochures/'.length).trim()

    if (!brochureId) {
      setJson(response, 404, { message: 'Share brochure not found' })
      return
    }

    if (isPostgresStorage()) {
      const result = await postgresQuery('DELETE FROM share_brochures WHERE id = $1 AND profile_id = $2 RETURNING id', [brochureId, profileId])

      if (!result.rows[0]) {
        setJson(response, 404, { message: 'Share brochure not found' })
        return
      }

      setJson(response, 200, { ok: true })
      return
    }

    const state = await readState()
    const existing = (state.shareBrochures ?? []).find((entry) => entry.id === brochureId)

    if (!existing || existing.profileId !== profileId) {
      setJson(response, 404, { message: 'Share brochure not found' })
      return
    }

    state.shareBrochures = (state.shareBrochures ?? []).filter((entry) => entry.id !== brochureId)
    await writeState(state)
    setJson(response, 200, { ok: true })
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
      workshopLocation: normalized.workshopLocation,
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
            workshop_name, workshop_location, parts_cost, labor_cost, other_cost, currency, attachment_count,
            attachment_names, attachments, is_recurring, recurrence_type, recurrence_interval_value,
            recurrence_interval_unit, recurrence_mileage_interval, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11::jsonb, $12, $13, $14, $15, $16,
            $17::jsonb, $18::jsonb, $19, $20, $21,
            $22, $23, $24, $25
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
          event.workshopLocation ? JSON.stringify(event.workshopLocation) : null,
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
            workshop_location = $8::jsonb,
            parts_cost = $9,
            labor_cost = $10,
            other_cost = $11,
            attachment_count = $12,
            attachment_names = $13::jsonb,
            attachments = $14::jsonb,
            is_recurring = $15,
            recurrence_type = $16,
            recurrence_interval_value = $17,
            recurrence_interval_unit = $18,
            recurrence_mileage_interval = $19,
            updated_at = $20,
            currency = 'PLN'
          WHERE id = $21 AND profile_id = $22
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
          normalized.workshopLocation ? JSON.stringify(normalized.workshopLocation) : null,
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
      workshopLocation: normalized.workshopLocation,
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

      const localState = { profiles: [], credentials: [], vehicles: [], serviceEvents: [] }
      const profile = registerProfile(localState, payload)
      const credential = localState.credentials[0]

      try {
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
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          setJson(response, 400, { message: 'Taki profil już istnieje' })
          return
        }

        throw error
      }

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

      let row = profileResult.rows[0]

      if (!row) {
        const legacyState = await getCachedLegacyState()

        try {
          const legacyProfile = loginProfile(legacyState, payload)
          const legacyCredential = legacyState.credentials.find((entry) => entry.profileId === legacyProfile.id)

          if (legacyCredential) {
            await postgresTransaction(async (client) => {
              await client.query(
                `
                  INSERT INTO profiles (id, username, display_name, created_at, updated_at)
                  VALUES ($1, $2, $3, $4, $5)
                  ON CONFLICT (id) DO UPDATE
                  SET username = EXCLUDED.username,
                      display_name = EXCLUDED.display_name,
                      updated_at = EXCLUDED.updated_at
                `,
                [legacyProfile.id, legacyProfile.username, legacyProfile.displayName, legacyProfile.createdAt, legacyProfile.updatedAt],
              )

              await client.query(
                `
                  INSERT INTO credentials (profile_id, username, password_hash, password_salt, created_at, updated_at)
                  VALUES ($1, $2, $3, $4, $5, $6)
                  ON CONFLICT (profile_id) DO UPDATE
                  SET username = EXCLUDED.username,
                      password_hash = EXCLUDED.password_hash,
                      password_salt = EXCLUDED.password_salt,
                      updated_at = EXCLUDED.updated_at
                `,
                [
                  legacyCredential.profileId,
                  legacyCredential.username,
                  legacyCredential.passwordHash,
                  legacyCredential.passwordSalt,
                  legacyCredential.createdAt,
                  legacyCredential.updatedAt,
                ],
              )
            })

            const refreshedResult = await postgresQuery(
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

            row = refreshedResult.rows[0]
          }
        } catch {
          // Fallback attempt failed; standard error handling below will return a validation message.
        }
      }

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
