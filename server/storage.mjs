import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

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

async function ensureStorageFile() {
  await mkdir(dataDir, { recursive: true })

  try {
    await readFile(dbPath, 'utf8')
  } catch {
    await writeFile(dbPath, JSON.stringify(emptyState, null, 2), 'utf8')
  }
}

export async function readState() {
  await ensureStorageFile()
  const content = await readFile(dbPath, 'utf8')

  try {
    const parsed = JSON.parse(content)

    if (!parsed || !Array.isArray(parsed.profiles) || !Array.isArray(parsed.credentials)) {
      return structuredClone(emptyState)
    }

    if (!Array.isArray(parsed.vehicles)) {
      parsed.vehicles = []
    }

    if (!Array.isArray(parsed.serviceEvents)) {
      parsed.serviceEvents = []
    }

    return parsed
  } catch {
    return structuredClone(emptyState)
  }
}

export async function writeState(nextState) {
  await ensureStorageFile()
  await writeFile(dbPath, JSON.stringify(nextState, null, 2), 'utf8')
}
