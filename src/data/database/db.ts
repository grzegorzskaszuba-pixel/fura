import Dexie, { type EntityTable } from 'dexie'

import { demoAppState, demoProfiles, demoServiceEvents, demoVehicles } from '@/data/seed/demo-data'
import type { AppStateRecord, ServiceEvent, UserProfile, Vehicle } from '@/shared/types/domain'

const APP_DB_NAME = 'fura-demo-db'
const LEGACY_DB_NAME = 'carlog-demo-db'

class FuraDatabase extends Dexie {
  profiles!: EntityTable<UserProfile, 'id'>
  vehicles!: EntityTable<Vehicle, 'id'>
  serviceEvents!: EntityTable<ServiceEvent, 'id'>
  appState!: EntityTable<AppStateRecord, 'key'>

  constructor() {
    super(APP_DB_NAME)

    this.version(2).stores({
      profiles: 'id, username, updatedAt',
      vehicles: 'id, profileId, updatedAt, archived',
      serviceEvents: 'id, [profileId+vehicleId], profileId, vehicleId, status, eventDate, mileage, updatedAt',
      appState: 'key',
    })
  }
}

class LegacyCarlogDatabase extends Dexie {
  profiles!: EntityTable<UserProfile, 'id'>
  vehicles!: EntityTable<Vehicle, 'id'>
  serviceEvents!: EntityTable<ServiceEvent, 'id'>
  appState!: EntityTable<AppStateRecord, 'key'>

  constructor() {
    super(LEGACY_DB_NAME)

    this.version(2).stores({
      profiles: 'id, username, updatedAt',
      vehicles: 'id, profileId, updatedAt, archived',
      serviceEvents: 'id, [profileId+vehicleId], profileId, vehicleId, status, eventDate, mileage, updatedAt',
      appState: 'key',
    })
  }
}

export const db = new FuraDatabase()

async function migrateLegacyDemoData() {
  const migrated = await db.appState.get('migrated-from-carlog')

  if (migrated?.value === 'true') {
    return
  }

  const [profilesCount, vehiclesCount, serviceEventsCount, appStateCount] = await Promise.all([
    db.profiles.count(),
    db.vehicles.count(),
    db.serviceEvents.count(),
    db.appState.count(),
  ])

  if (profilesCount + vehiclesCount + serviceEventsCount + appStateCount > 0) {
    await db.appState.put({ key: 'migrated-from-carlog', value: 'true' })
    return
  }

  const legacyDb = new LegacyCarlogDatabase()

  try {
    await legacyDb.open()

    const [legacyProfiles, legacyVehicles, legacyServiceEvents, legacyAppState] = await Promise.all([
      legacyDb.profiles.toArray(),
      legacyDb.vehicles.toArray(),
      legacyDb.serviceEvents.toArray(),
      legacyDb.appState.toArray(),
    ])

    if (legacyProfiles.length + legacyVehicles.length + legacyServiceEvents.length + legacyAppState.length === 0) {
      return
    }

    await db.transaction('rw', db.profiles, db.vehicles, db.serviceEvents, db.appState, async () => {
      if (legacyProfiles.length > 0) {
        await db.profiles.bulkPut(legacyProfiles)
      }
      if (legacyVehicles.length > 0) {
        await db.vehicles.bulkPut(legacyVehicles)
      }
      if (legacyServiceEvents.length > 0) {
        await db.serviceEvents.bulkPut(legacyServiceEvents)
      }
      if (legacyAppState.length > 0) {
        await db.appState.bulkPut(legacyAppState)
      }
      await db.appState.put({ key: 'migrated-from-carlog', value: 'true' })
    })
  } catch {
    // Ignore migration errors and fall back to regular initialization below.
  } finally {
    legacyDb.close()
  }
}

export async function initializeDatabase() {
  await migrateLegacyDemoData()

  const seeded = await db.appState.get('seeded')
  const [demoProfile, demoVehicle, demoEvent] = await Promise.all([
    db.profiles.get('profile-demo-main'),
    db.vehicles.get('vehicle-bmw-320d'),
    db.serviceEvents.get('event-bmw-oil'),
  ])

  if (seeded?.value === 'true' && demoProfile && demoVehicle && demoEvent) {
    await db.transaction('rw', db.vehicles, db.serviceEvents, async () => {
      await Promise.all(
        demoVehicles.map(async (vehicle) => {
          const existing = await db.vehicles.get(vehicle.id)

          if (!existing || existing.imageUrl === vehicle.imageUrl) {
            return
          }

          await db.vehicles.update(vehicle.id, { imageUrl: vehicle.imageUrl })
        }),
      )

      await Promise.all(
        demoServiceEvents.map(async (event) => {
          const existing = await db.serviceEvents.get(event.id)

          if (!existing) {
            return
          }

          const nextSignature = JSON.stringify({
            attachmentCount: event.attachmentCount,
            attachmentNames: event.attachmentNames,
            attachments: event.attachments,
          })
          const existingSignature = JSON.stringify({
            attachmentCount: existing.attachmentCount,
            attachmentNames: existing.attachmentNames,
            attachments: existing.attachments,
          })

          if (existingSignature === nextSignature) {
            return
          }

          await db.serviceEvents.update(event.id, {
            attachmentCount: event.attachmentCount,
            attachmentNames: event.attachmentNames,
            attachments: event.attachments,
          })
        }),
      )
    })

    return
  }

  await db.transaction('rw', db.profiles, db.vehicles, db.serviceEvents, db.appState, async () => {
    await db.profiles.bulkPut(demoProfiles)
    await db.vehicles.bulkPut(demoVehicles)
    await db.serviceEvents.bulkPut(demoServiceEvents)
    await db.appState.bulkPut(demoAppState)
  })
}

export async function resetDatabase() {
  await db.delete()
  await db.open()
}
