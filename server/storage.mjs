import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Pool } from 'pg'

import { migrateAuthState } from './auth-core.mjs'

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
  shareBrochures: [],
  emailVerificationTokens: [],
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
      connectionTimeoutMillis: Number(process.env.AUTH_DATABASE_CONNECTION_TIMEOUT_MS ?? 6000),
      idleTimeoutMillis: Number(process.env.AUTH_DATABASE_IDLE_TIMEOUT_MS ?? 30000),
    })
  : null

let pgInitialized = false
let normalizedInitialized = false
let normalizedInitializationPromise = null

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
  const maxAttempts = Number(process.env.AUTH_DATABASE_MAX_ATTEMPTS ?? 3)
  const baseDelayMs = Number(process.env.AUTH_DATABASE_RETRY_DELAY_MS ?? 250)
  const maxDelayMs = Number(process.env.AUTH_DATABASE_RETRY_MAX_DELAY_MS ?? 5000)
  const maxElapsedMs = Number(process.env.AUTH_DATABASE_RETRY_MAX_ELAPSED_MS ?? 9000)
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

function monitorPostgresClient(client, context) {
  client.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error(`[storage] postgres client error during ${context}:`, error)
  })

  return client
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
    shareBrochures: Array.isArray(candidate.shareBrochures) ? candidate.shareBrochures : [],
    emailVerificationTokens: Array.isArray(candidate.emailVerificationTokens) ? candidate.emailVerificationTokens : [],
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

  if (normalizedInitializationPromise) {
    await normalizedInitializationPromise
    return
  }

  normalizedInitializationPromise = initializeNormalizedPostgresStorage()

  try {
    await normalizedInitializationPromise
  } finally {
    normalizedInitializationPromise = null
  }
}

async function initializeNormalizedPostgresStorage() {

  await withPostgresRetry(async () => {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        email_verified_at TIMESTAMPTZ
      )
    `)

    const profileVerificationColumn = await pgPool.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'profiles'
          AND column_name = 'email_verified_at'
        LIMIT 1
      `,
    )

    if (profileVerificationColumn.rows.length === 0) {
      await pgPool.query('ALTER TABLE profiles ADD COLUMN email_verified_at TIMESTAMPTZ')
      await pgPool.query('UPDATE profiles SET email_verified_at = created_at WHERE email_verified_at IS NULL')
    }

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
        workshop_location JSONB,
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

    await pgPool.query('ALTER TABLE service_events ADD COLUMN IF NOT EXISTS workshop_location JSONB')

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS share_brochures (
        id TEXT PRIMARY KEY,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL
      )
    `)

    await pgPool.query('CREATE INDEX IF NOT EXISTS service_events_profile_updated_idx ON service_events (profile_id, updated_at DESC)')
    await pgPool.query('CREATE INDEX IF NOT EXISTS service_events_vehicle_updated_idx ON service_events (vehicle_id, updated_at DESC)')
    await pgPool.query('CREATE INDEX IF NOT EXISTS share_brochures_profile_expires_idx ON share_brochures (profile_id, expires_at DESC)')
    await pgPool.query('CREATE INDEX IF NOT EXISTS share_brochures_expires_idx ON share_brochures (expires_at)')

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id UUID PRIMARY KEY,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ
      )
    `)

    await pgPool.query('CREATE INDEX IF NOT EXISTS email_verification_tokens_profile_idx ON email_verification_tokens (profile_id)')
  })

  await withPostgresRetry(async () => {
    await ensurePostgresStorage()
    const legacyResult = await pgPool.query('SELECT state FROM app_state WHERE id = 1 LIMIT 1')
    const legacyState = normalizeState(legacyResult.rows[0]?.state ?? emptyState)
    migrateAuthState(legacyState)

    const normalizedAuthResult = await pgPool.query(`
      SELECT
        p.id,
        p.username,
        c.username AS credential_username,
        c.password_hash,
        c.password_salt,
        c.created_at,
        c.updated_at
      FROM profiles p
      LEFT JOIN credentials c ON c.profile_id = p.id
    `)
    const normalizedAuthState = {
      profiles: normalizedAuthResult.rows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      credentials: normalizedAuthResult.rows
        .filter((row) => row.credential_username)
        .map((row) => ({
          profileId: row.id,
          username: row.credential_username,
          passwordHash: row.password_hash,
          passwordSalt: row.password_salt,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
    }
    const previousProfileUsernames = new Map(normalizedAuthState.profiles.map((profile) => [profile.id, profile.username]))
    const previousCredentialUsernames = new Map(normalizedAuthState.credentials.map((credential) => [credential.profileId, credential.username]))
    const normalizedAuthChanged = migrateAuthState(normalizedAuthState)

    if (normalizedAuthChanged) {
      const client = monitorPostgresClient(await pgPool.connect(), 'auth migration')

      try {
        await client.query('BEGIN')

        for (const profile of normalizedAuthState.profiles) {
          if (previousProfileUsernames.get(profile.id) !== profile.username) {
            await client.query('UPDATE profiles SET username = $1 WHERE id = $2', [`migration-${profile.id}@fura.info`, profile.id])
          }
        }

        for (const credential of normalizedAuthState.credentials) {
          if (previousCredentialUsernames.get(credential.profileId) !== credential.username) {
            await client.query('UPDATE credentials SET username = $1 WHERE profile_id = $2', [`migration-${credential.profileId}@fura.info`, credential.profileId])
          }
        }

        for (const profile of normalizedAuthState.profiles) {
          if (previousProfileUsernames.get(profile.id) !== profile.username) {
            await client.query('UPDATE profiles SET username = $1 WHERE id = $2', [profile.username, profile.id])
          }
        }

        for (const credential of normalizedAuthState.credentials) {
          if (previousCredentialUsernames.get(credential.profileId) !== credential.username) {
            await client.query('UPDATE credentials SET username = $1 WHERE profile_id = $2', [credential.username, credential.profileId])
          }
        }

        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    if (
      legacyState.profiles.length === 0 &&
      legacyState.credentials.length === 0 &&
      legacyState.vehicles.length === 0 &&
      legacyState.serviceEvents.length === 0 &&
      legacyState.shareBrochures.length === 0
    ) {
      return
    }

    const client = monitorPostgresClient(await pgPool.connect(), 'legacy data migration')

    try {
      await client.query('BEGIN')

      for (const profile of legacyState.profiles) {
        await client.query(
          `
            INSERT INTO profiles (id, username, display_name, created_at, updated_at, email_verified_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
          `,
          [profile.id, profile.username, profile.displayName, profile.createdAt, profile.updatedAt, profile.createdAt],
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
              workshop_name, workshop_location, parts_cost, labor_cost, other_cost, currency, attachment_count,
              attachment_names, attachments, is_recurring, recurrence_type,
              recurrence_interval_value, recurrence_interval_unit, recurrence_mileage_interval,
              created_at, updated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11::jsonb, $12, $13, $14, $15, $16,
              $17::jsonb, $18::jsonb, $19, $20,
              $21, $22, $23,
              $24, $25
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
            event.workshopLocation ? JSON.stringify(event.workshopLocation) : null,
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

      for (const brochure of legacyState.shareBrochures ?? []) {
        await client.query(
          `
            INSERT INTO share_brochures (id, profile_id, vehicle_id, created_at, expires_at, payload)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            ON CONFLICT (id) DO NOTHING
          `,
          [
            brochure.id,
            brochure.profileId,
            brochure.vehicleId,
            brochure.createdAt,
            brochure.expiresAt,
            JSON.stringify(brochure.payload ?? {}),
          ],
        )
      }

      await client.query('DELETE FROM app_state WHERE id = 1')
      await client.query('INSERT INTO app_state (id, state) VALUES (1, $1::jsonb)', [JSON.stringify(emptyState)])

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

export async function initializeStorage() {
  if (usePostgres) {
    await ensureNormalizedPostgresStorage()
    return
  }

  await ensureStorageFile()
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
  const client = monitorPostgresClient(await withPostgresRetry(() => pgPool.connect()), 'transaction')

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      // eslint-disable-next-line no-console
      console.error('[storage] postgres transaction rollback failed:', rollbackError)
    }

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
    const state = await readStatePostgres()

    if (migrateAuthState(state)) {
      await writeStatePostgres(state)
    }

    return state
  }

  await ensureStorageFile()
  const content = await readFile(dbPath, 'utf8')

  try {
    const state = normalizeState(JSON.parse(content))

    if (migrateAuthState(state)) {
      await writeFile(dbPath, JSON.stringify(state, null, 2), 'utf8')
    }

    return state
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
