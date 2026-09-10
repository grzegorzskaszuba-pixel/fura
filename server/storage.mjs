import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Pool } from 'pg'

const resolvedDbPath = process.env.AUTH_DB_FILE
  ? path.resolve(process.env.AUTH_DB_FILE)
  : path.resolve('server/data/auth-db.json')
const dataDir = path.dirname(resolvedDbPath)
const dbPath = resolvedDbPath

const emptyState = {
  profiles: [],
  credentials: [],
  vehicles: [],
  serviceEvents: [],
}

const storageMode = String(process.env.AUTH_STORAGE ?? '').trim().toLowerCase()
const postgresUrl = String(
  process.env.AUTH_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.INTERNAL_DATABASE_URL ??
    '',
).trim()
const authDatabaseSsl = String(process.env.AUTH_DATABASE_SSL ?? '').trim().toLowerCase()
const usePostgres = storageMode === 'postgres' || (storageMode.length === 0 && postgresUrl.length > 0)

function resolvePostgresSsl() {
  if (!usePostgres) {
    return undefined
  }

  if (authDatabaseSsl === 'disable' || authDatabaseSsl === 'off' || authDatabaseSsl === 'false') {
    return undefined
  }

  if (authDatabaseSsl === 'require' || authDatabaseSsl === 'on' || authDatabaseSsl === 'true') {
    return { rejectUnauthorized: false }
  }

  if (postgresUrl.includes('render.com') || process.env.RENDER === 'true') {
    return { rejectUnauthorized: false }
  }

  return undefined
}

const pgPool = usePostgres
  ? new Pool({
      connectionString: postgresUrl,
      ssl: resolvePostgresSsl(),
      max: Number(process.env.AUTH_DATABASE_POOL_MAX ?? 10),
      connectionTimeoutMillis: Number(process.env.AUTH_DATABASE_CONNECTION_TIMEOUT_MS ?? 2500),
      idleTimeoutMillis: Number(process.env.AUTH_DATABASE_IDLE_TIMEOUT_MS ?? 30000),
    })
  : null

let pgInitialized = false
let normalizedInitialized = false

export class StorageError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'StorageError'
    this.statusCode = options.statusCode ?? 500
    this.retryable = options.retryable ?? false
    this.cause = options.cause
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isTransientPostgresError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = String(error?.message ?? '').toLowerCase()

  if (
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '08000' ||
    code === '08001' ||
    code === '08003' ||
    code === '08004' ||
    code === '08006' ||
    code === '53300' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'ENOTFOUND'
  ) {
    return true
  }

  return (
    message.includes('connection terminated unexpectedly') ||
    message.includes('terminating connection') ||
    message.includes('connection reset') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('connection timeout') ||
    message.includes('too many clients already') ||
    message.includes('client has encountered a connection error')
  )
}

function toStorageError(error) {
  if (error instanceof StorageError) {
    return error
  }

  if (error instanceof Error && error.message.includes('Brak konfiguracji bazy PostgreSQL')) {
    return new StorageError(error.message, {
      statusCode: 500,
      retryable: false,
      cause: error,
    })
  }

  if (isTransientPostgresError(error)) {
    return new StorageError('Tymczasowy problem z polaczeniem do bazy danych. Sprobuj ponownie.', {
      statusCode: 503,
      retryable: true,
      cause: error,
    })
  }

  return new StorageError('Nie udalo sie odczytac lub zapisac danych.', {
    statusCode: 500,
    retryable: false,
    cause: error,
  })
}

async function withPostgresRetry(operation) {
  const maxAttempts = Number(process.env.AUTH_DATABASE_MAX_ATTEMPTS ?? 5)
  const baseDelayMs = Number(process.env.AUTH_DATABASE_RETRY_DELAY_MS ?? 250)
  const maxDelayMs = Number(process.env.AUTH_DATABASE_RETRY_MAX_DELAY_MS ?? 5000)
  const maxElapsedMs = Number(process.env.AUTH_DATABASE_RETRY_MAX_ELAPSED_MS ?? 7000)
  const startedAt = Date.now()

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      const transient = isTransientPostgresError(error)
      const elapsedMs = Date.now() - startedAt

      if (!transient || attempt === maxAttempts || elapsedMs >= maxElapsedMs) {
        throw toStorageError(error)
      }

      const exponential = baseDelayMs * 2 ** (attempt - 1)
      const jitter = Math.floor(Math.random() * Math.max(25, Math.floor(baseDelayMs / 2)))
      const remainingMs = Math.max(0, maxElapsedMs - elapsedMs)
      const delayMs = Math.min(maxDelayMs, exponential + jitter, remainingMs)

      if (delayMs <= 0) {
        throw toStorageError(error)
      }

      await wait(delayMs)
    }
  }

  throw new StorageError('Nie udalo sie wykonac operacji bazy danych.')
}

if (pgPool) {
  pgPool.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('[storage] postgres pool idle client error:', error)
  })
}

async function ensureStorageFile() {
  await mkdir(dataDir, { recursive: true })

  try {
    await readFile(dbPath, 'utf8')
  } catch {
    await writeFile(dbPath, JSON.stringify(emptyState, null, 2), 'utf8')
  }
}

function normalizeState(candidate) {
  if (!candidate || !Array.isArray(candidate.profiles) || !Array.isArray(candidate.credentials)) {
    return structuredClone(emptyState)
  }

  const normalized = {
    profiles: candidate.profiles,
    credentials: candidate.credentials,
    vehicles: Array.isArray(candidate.vehicles) ? candidate.vehicles : [],
    serviceEvents: Array.isArray(candidate.serviceEvents) ? candidate.serviceEvents : [],
  }

  return normalized
}

async function ensurePostgresStorage() {
  if (!pgPool) {
    throw new Error('Postgres storage is not initialized')
  }

  if (!postgresUrl) {
    throw new Error('Brak konfiguracji bazy PostgreSQL: ustaw DATABASE_URL lub AUTH_DATABASE_URL')
  }

  if (pgInitialized) {
    return
  }

  await withPostgresRetry(async () => {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id SMALLINT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (id = 1)
      )
    `)

    await pgPool.query('INSERT INTO app_state (id, state) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING', [JSON.stringify(emptyState)])
    pgInitialized = true
  })
}

async function ensureNormalizedPostgresStorage() {
  if (!pgPool) {
    throw new Error('Postgres storage is not initialized')
  }

  if (!postgresUrl) {
    throw new Error('Brak konfiguracji bazy PostgreSQL: ustaw DATABASE_URL lub AUTH_DATABASE_URL')
  }

  if (normalizedInitialized) {
    return
  }

  await withPostgresRetry(async () => {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER,
        body_type TEXT,
        fuel_type TEXT,
        transmission TEXT,
        engine TEXT,
        power INTEGER,
        color TEXT,
        vin TEXT,
        registration_number TEXT,
        current_mileage INTEGER,
        image_url TEXT,
        notes TEXT,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)

    await pgPool.query('CREATE INDEX IF NOT EXISTS vehicles_profile_updated_idx ON vehicles (profile_id, updated_at DESC)')

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS service_events (
        id UUID PRIMARY KEY,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        event_date TEXT,
        mileage INTEGER,
        description TEXT,
        workshop_name TEXT,
        parts_cost NUMERIC,
        labor_cost NUMERIC,
        other_cost NUMERIC,
        currency TEXT NOT NULL DEFAULT 'PLN',
        attachment_count INTEGER,
        attachment_names JSONB,
        attachments JSONB,
        is_recurring BOOLEAN,
        recurrence_type TEXT,
        recurrence_interval_value INTEGER,
        recurrence_interval_unit TEXT,
        recurrence_mileage_interval INTEGER,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)

    await pgPool.query('CREATE INDEX IF NOT EXISTS service_events_profile_updated_idx ON service_events (profile_id, updated_at DESC)')
    await pgPool.query('CREATE INDEX IF NOT EXISTS service_events_vehicle_updated_idx ON service_events (vehicle_id, updated_at DESC)')
  })

  await withPostgresRetry(async () => {
    const profileCountResult = await pgPool.query('SELECT COUNT(*)::int AS count FROM profiles')
    const profileCount = profileCountResult.rows[0]?.count ?? 0

    if (profileCount > 0) {
      return
    }

    await ensurePostgresStorage()
    const legacyResult = await pgPool.query('SELECT state FROM app_state WHERE id = 1 LIMIT 1')
    const legacyState = normalizeState(legacyResult.rows[0]?.state ?? emptyState)

    if (legacyState.profiles.length === 0 && legacyState.credentials.length === 0 && legacyState.vehicles.length === 0 && legacyState.serviceEvents.length === 0) {
      return
    }

    const client = await pgPool.connect()

    try {
      await client.query('BEGIN')

      for (const profile of legacyState.profiles) {
        await client.query(
          `
            INSERT INTO profiles (id, username, display_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
          `,
          [profile.id, profile.username, profile.displayName, profile.createdAt, profile.updatedAt],
        )
      }

      for (const credential of legacyState.credentials) {
        await client.query(
          `
            INSERT INTO credentials (profile_id, username, password_hash, password_salt, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (profile_id) DO NOTHING
          `,
          [credential.profileId, credential.username, credential.passwordHash, credential.passwordSalt, credential.createdAt, credential.updatedAt],
        )
      }

      for (const vehicle of legacyState.vehicles) {
        await client.query(
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
            ON CONFLICT (id) DO NOTHING
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
      }

      for (const event of legacyState.serviceEvents) {
        await client.query(
          `
            INSERT INTO service_events (
              id, profile_id, vehicle_id, status, category, title, event_date, mileage, description,
              workshop_name, parts_cost, labor_cost, other_cost, currency, attachment_count,
              attachment_names, attachments, is_recurring, recurrence_type,
              recurrence_interval_value, recurrence_interval_unit, recurrence_mileage_interval,
              created_at, updated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15,
              $16::jsonb, $17::jsonb, $18, $19,
              $20, $21, $22,
              $23, $24
            )
            ON CONFLICT (id) DO NOTHING
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
            event.currency ?? 'PLN',
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
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  normalizedInitialized = true
}

export function isPostgresStorage() {
  return usePostgres
}

export async function postgresQuery(queryText, params = []) {
  if (!pgPool) {
    throw new StorageError('Postgres storage is not initialized')
  }

  try {
    await ensureNormalizedPostgresStorage()
    return await withPostgresRetry(() => pgPool.query(queryText, params))
  } catch (error) {
    throw toStorageError(error)
  }
}

export async function postgresTransaction(callback) {
  if (!pgPool) {
    throw new StorageError('Postgres storage is not initialized')
  }

  await ensureNormalizedPostgresStorage()
  const client = await pgPool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw toStorageError(error)
  } finally {
    client.release()
  }
}

async function readStatePostgres() {
  if (!pgPool) {
    throw new Error('Postgres storage is not initialized')
  }

  await ensurePostgresStorage()
  const result = await withPostgresRetry(() => pgPool.query('SELECT state FROM app_state WHERE id = 1 LIMIT 1'))
  const candidate = result.rows[0]?.state ?? emptyState
  return normalizeState(candidate)
}

async function writeStatePostgres(nextState) {
  if (!pgPool) {
    throw new Error('Postgres storage is not initialized')
  }

  await ensurePostgresStorage()
  const serializedState = JSON.stringify(normalizeState(nextState))
  const result = await withPostgresRetry(() =>
    pgPool.query('UPDATE app_state SET state = $1::jsonb, updated_at = NOW() WHERE id = 1', [serializedState]),
  )

  if (result.rowCount === 0) {
    await withPostgresRetry(() => pgPool.query('INSERT INTO app_state (id, state) VALUES (1, $1::jsonb)', [serializedState]))
  }
}

export async function readState() {
  if (usePostgres) {
    return readStatePostgres()
  }

  await ensureStorageFile()
  const content = await readFile(dbPath, 'utf8')

  try {
    return normalizeState(JSON.parse(content))
  } catch {
    return structuredClone(emptyState)
  }
}

export async function writeState(nextState) {
  if (usePostgres) {
    await writeStatePostgres(nextState)
    return
  }

  await ensureStorageFile()
  await writeFile(dbPath, JSON.stringify(normalizeState(nextState), null, 2), 'utf8')
}
