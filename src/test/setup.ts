import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach } from 'vitest'

import { initializeDatabase, resetDatabase } from '@/data/database/db'
import { appStateRepository } from '@/data/repositories/app-state-repository'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
})

beforeEach(async () => {
  await resetDatabase()
  await initializeDatabase()
  await appStateRepository.setCurrentProfileId(null)
})

afterEach(() => {
  cleanup()
})
