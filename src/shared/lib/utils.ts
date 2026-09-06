import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId() {
  const webCrypto = globalThis.crypto

  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID()
  }

  if (webCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16)
    webCrypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function toNullableNumber(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? undefined : value
}
