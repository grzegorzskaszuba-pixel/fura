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
      connectionTimeoutMillis: Number(process.env.AUTH_DATABASE_CONNECTION_TIMEOUT_MS ?? 10000),
      idleTimeoutMillis: Number(process.env.AUTH_DATABASE_IDLE_TIMEOUT_MS ?? 30000),
    })
  : null

let pgInitialized = false

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
  const maxAttempts = Number(process.env.AUTH_DATABASE_MAX_ATTEMPTS ?? 8)
  const baseDelayMs = Number(process.env.AUTH_DATABASE_RETRY_DELAY_MS ?? 250)
  const maxDelayMs = Number(process.env.AUTH_DATABASE_RETRY_MAX_DELAY_MS ?? 5000)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      const transient = isTransientPostgresError(error)

      if (!transient || attempt === maxAttempts) {
        throw toStorageError(error)
      }

      const exponential = baseDelayMs * 2 ** (attempt - 1)
      const jitter = Math.floor(Math.random() * Math.max(25, Math.floor(baseDelayMs / 2)))
      const delayMs = Math.min(maxDelayMs, exponential + jitter)
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
