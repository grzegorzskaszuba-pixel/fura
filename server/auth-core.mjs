import crypto from 'node:crypto'

function createId() {
  return crypto.randomUUID()
}

function now() {
  return new Date().toISOString()
}

function normalizeUsername(username) {
  return String(username).trim().toLowerCase()
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function normalizeEmail(email) {
  const normalizedEmail = normalizeUsername(email)

  if (!isEmail(normalizedEmail)) {
    throw new Error('Podaj prawidłowy adres e-mail')
  }

  return normalizedEmail
}

function createLegacyEmail(username, usedEmails) {
  const localPart = normalizeUsername(username)
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '') || 'user'
  const baseEmail = `${localPart}@fura.info`
  let email = baseEmail
  let suffix = 2

  while (usedEmails.has(email)) {
    email = `${localPart}${suffix}@fura.info`
    suffix += 1
  }

  return email
}

export function getLoginCandidates(email) {
  const normalizedEmail = normalizeEmail(email)
  const candidates = [normalizedEmail]

  if (normalizedEmail.endsWith('@fura.info')) {
    const localPart = normalizedEmail.slice(0, -'@fura.info'.length)
    candidates.push(`${localPart}@gmail.com`)
  }

  return candidates
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = hashPassword(password, salt)
  return { salt, hash }
}

function verifyPassword(password, salt, expectedHash) {
  const hash = hashPassword(password, salt)
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  const hashBuffer = Buffer.from(hash, 'hex')

  if (expectedBuffer.length !== hashBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(hashBuffer, expectedBuffer)
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('Hasło musi mieć co najmniej 6 znaków')
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

export function getSessionProfileId(sessions, sessionId) {
  if (!sessionId) {
    return null
  }

  return sessions.get(sessionId) ?? null
}

export function registerProfile(state, input) {
  const username = normalizeEmail(input.username)
  const password = String(input.password ?? '')
  const displayName = String(input.displayName ?? '').trim()

  if (displayName.length < 2) {
    throw new Error('Podaj nazwę użytkownika')
  }

  validatePassword(password)

  if (state.profiles.some((profile) => profile.username === username)) {
    throw new Error('Taki profil już istnieje')
  }

  const timestamp = now()
  const profile = {
    id: createId(),
    username,
    displayName,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const passwordData = createPasswordHash(password)
  const credentials = {
    profileId: profile.id,
    username,
    passwordHash: passwordData.hash,
    passwordSalt: passwordData.salt,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  state.profiles.push(profile)
  state.credentials.push(credentials)

  return sanitizeProfile(profile)
}

export function loginProfile(state, input) {
  const username = normalizeEmail(input.username)
  const password = String(input.password ?? '')

  const credentials = state.credentials.find((entry) => getLoginCandidates(username).includes(entry.username))

  if (!credentials) {
    throw new Error('Nie znaleziono profilu o podanej nazwie użytkownika')
  }

  const valid = verifyPassword(password, credentials.passwordSalt, credentials.passwordHash)

  if (!valid) {
    throw new Error('Nieprawidłowe hasło')
  }

  const profile = state.profiles.find((entry) => entry.id === credentials.profileId)

  if (!profile) {
    throw new Error('Profil nie istnieje')
  }

  if (credentials.username !== username) {
    credentials.username = username
    profile.username = username
  }

  profile.updatedAt = now()
  credentials.updatedAt = now()
  return sanitizeProfile(profile)
}

export function resetPassword(state, input) {
  const username = normalizeEmail(input.username)
  const password = String(input.password ?? '')
  validatePassword(password)

  const credentials = state.credentials.find((entry) => entry.username === username)

  if (!credentials) {
    throw new Error('Nie znaleziono profilu o podanej nazwie użytkownika')
  }

  const passwordData = createPasswordHash(password)
  credentials.passwordHash = passwordData.hash
  credentials.passwordSalt = passwordData.salt
  credentials.updatedAt = now()
}

export function changePassword(state, input) {
  const profileId = String(input.profileId ?? '')
  const currentPassword = String(input.currentPassword ?? '')
  const newPassword = String(input.newPassword ?? '')

  validatePassword(newPassword)

  const credentials = state.credentials.find((entry) => entry.profileId === profileId)

  if (!credentials) {
    throw new Error('Brak danych logowania dla profilu')
  }

  const valid = verifyPassword(currentPassword, credentials.passwordSalt, credentials.passwordHash)

  if (!valid) {
    throw new Error('Nieprawidłowe obecne hasło')
  }

  const passwordData = createPasswordHash(newPassword)
  credentials.passwordHash = passwordData.hash
  credentials.passwordSalt = passwordData.salt
  credentials.updatedAt = now()
}

export function removeProfileData(state, profileId) {
  const normalizedProfileId = String(profileId ?? '')
  const profileCount = Array.isArray(state.profiles) ? state.profiles.length : 0

  state.profiles = (state.profiles ?? []).filter((profile) => profile.id !== normalizedProfileId)
  state.credentials = (state.credentials ?? []).filter((credential) => credential.profileId !== normalizedProfileId)
  state.vehicles = (state.vehicles ?? []).filter((vehicle) => vehicle.profileId !== normalizedProfileId)
  state.serviceEvents = (state.serviceEvents ?? []).filter((event) => event.profileId !== normalizedProfileId)
  state.shareBrochures = (state.shareBrochures ?? []).filter((brochure) => brochure.profileId !== normalizedProfileId)
  state.emailVerificationTokens = (state.emailVerificationTokens ?? []).filter((token) => token.profileId !== normalizedProfileId)
  state.passwordResetTokens = (state.passwordResetTokens ?? []).filter((token) => token.profileId !== normalizedProfileId)

  return state.profiles.length !== profileCount
}

export function migrateAuthState(state) {
  const usedEmails = new Set()
  let changed = false

  for (const profile of state.profiles) {
    const credential = state.credentials.find((entry) => entry.profileId === profile.id)
    const currentUsername = normalizeUsername(profile.username || credential?.username || '')
    const email = isEmail(currentUsername) && !usedEmails.has(currentUsername) ? currentUsername : createLegacyEmail(currentUsername, usedEmails)

    usedEmails.add(email)

    if (profile.username !== email) {
      profile.username = email
      changed = true
    }

    if (credential && credential.username !== email) {
      credential.username = email
      changed = true
    }
  }

  for (const credential of state.credentials) {
    if (usedEmails.has(credential.username)) {
      continue
    }

    const currentUsername = normalizeUsername(credential.username)
    const email = isEmail(currentUsername) ? currentUsername : createLegacyEmail(currentUsername, usedEmails)

    if (credential.username !== email) {
      credential.username = email
      changed = true
    }

    usedEmails.add(email)
  }

  return changed
}

