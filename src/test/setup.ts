import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach } from 'vitest'

import { initializeDatabase, resetDatabase } from '@/data/database/db'
import { appStateRepository } from '@/data/repositories/app-state-repository'
import { serviceEventRepository } from '@/data/repositories/service-event-repository'
import { vehicleRepository } from '@/data/repositories/vehicle-repository'
import { appAuthService } from '@/features/auth/app-auth-service'

beforeAll(() => {
  if (typeof window === 'undefined') {
    return
  }

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
  if (typeof window === 'undefined') {
    return
  }

  await resetDatabase()
  await initializeDatabase()

  const profile = await appAuthService.register({
    username: 'tester',
    displayName: 'Tester',
    password: 'haslo123',
  })

  const primaryVehicle = await vehicleRepository.create(profile.id, {
    name: 'BMW 320d',
    make: 'BMW',
    model: '320d',
    year: 2019,
    currentMileage: 128450,
    imageUrl: '/test-image-1.png',
  })

  await vehicleRepository.create(profile.id, {
    name: 'Audi Q5',
    make: 'Audi',
    model: 'Q5',
    year: 2020,
    currentMileage: 81200,
    imageUrl: '/test-image-2.png',
  })

  await serviceEventRepository.create(profile.id, primaryVehicle.id, {
    status: 'completed',
    category: 'oil_fluids',
    title: 'Wymiana oleju i filtra',
    eventDate: '2026-06-01',
    mileage: 128450,
    workshopName: 'Auto Serwis',
  })

  await appStateRepository.setCurrentProfileId(profile.id)
  await appStateRepository.setCurrentVehicleId(profile.id, primaryVehicle.id)
})

afterEach(() => {
  if (typeof window === 'undefined') {
    return
  }

  cleanup()
})
