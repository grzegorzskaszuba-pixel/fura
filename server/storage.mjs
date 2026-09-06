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
    })
  : null

let pgInitialized = false

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
}

async function readStatePostgres() {
  if (!pgPool) {
    throw new Error('Postgres storage is not initialized')
  }

  await ensurePostgresStorage()
  const result = await pgPool.query('SELECT state FROM app_state WHERE id = 1 LIMIT 1')
  const candidate = result.rows[0]?.state ?? emptyState
  return normalizeState(candidate)
}

async function writeStatePostgres(nextState) {
  if (!pgPool) {
    throw new Error('Postgres storage is not initialized')
  }

  await ensurePostgresStorage()
  const serializedState = JSON.stringify(normalizeState(nextState))
  const result = await pgPool.query('UPDATE app_state SET state = $1::jsonb, updated_at = NOW() WHERE id = 1', [serializedState])

  if (result.rowCount === 0) {
    await pgPool.query('INSERT INTO app_state (id, state) VALUES (1, $1::jsonb)', [serializedState])
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
