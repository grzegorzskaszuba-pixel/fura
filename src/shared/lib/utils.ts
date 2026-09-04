import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId() {
  return crypto.randomUUID()
}

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function toNullableNumber(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? undefined : value
}
