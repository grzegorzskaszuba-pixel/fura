const SALT_LENGTH = 16

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(value: string) {
  if (value.length % 2 !== 0) {
    throw new Error('Invalid hex value')
  }

  const bytes = new Uint8Array(value.length / 2)

  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }

  return bytes
}

function createSalt() {
  const salt = new Uint8Array(SALT_LENGTH)
  crypto.getRandomValues(salt)
  return toHex(salt)
}

async function hashSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(new Uint8Array(digest))
}

export async function hashPassword(password: string, salt: string) {
  return hashSecret(`${salt}:${password}`)
}

export async function createPasswordHash(password: string) {
  const salt = createSalt()
  const hash = await hashPassword(password, salt)

  return { salt, hash }
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  if (fromHex(salt).length !== SALT_LENGTH) {
    return false
  }

  const hash = await hashPassword(password, salt)
  return hash === expectedHash
}
