import Dexie, { type EntityTable } from 'dexie'

import type { AppStateRecord, AuthCredentialRecord, ServiceEvent, UserProfile, Vehicle } from '@/shared/types/domain'

const APP_DB_NAME = 'fura-app-db'
const LEGACY_DB_NAMES = ['fura-demo-db', 'carlog-demo-db']
const DEMO_PROFILE_IDS = new Set(['profile-demo-main', 'profile-demo-second'])
const DEMO_USERNAMES = new Set(['demo', 'ania'])
const CURRENT_PROFILE_KEY = 'currentProfileId'

class FuraDatabase extends Dexie {
  profiles!: EntityTable<UserProfile, 'id'>
  authCredentials!: EntityTable<AuthCredentialRecord, 'profileId'>
  vehicles!: EntityTable<Vehicle, 'id'>
  serviceEvents!: EntityTable<ServiceEvent, 'id'>
  appState!: EntityTable<AppStateRecord, 'key'>

  constructor() {
    super(APP_DB_NAME)

    this.version(3).stores({
      profiles: 'id, username, updatedAt',
      authCredentials: 'profileId, username, updatedAt',
      vehicles: 'id, profileId, updatedAt, archived',
      serviceEvents: 'id, [profileId+vehicleId], profileId, vehicleId, status, eventDate, mileage, updatedAt',
      appState: 'key',
    })
  }
}

class LegacyDatabase extends Dexie {
  profiles!: EntityTable<UserProfile, 'id'>
  vehicles!: EntityTable<Vehicle, 'id'>
  serviceEvents!: EntityTable<ServiceEvent, 'id'>
  appState!: EntityTable<AppStateRecord, 'key'>

  constructor(name: string) {
    super(name)

    this.version(2).stores({
      profiles: 'id, username, updatedAt',
      vehicles: 'id, profileId, updatedAt, archived',
      serviceEvents: 'id, [profileId+vehicleId], profileId, vehicleId, status, eventDate, mileage, updatedAt',
      appState: 'key',
    })
  }
}

export const db = new FuraDatabase()

async function hasApplicationData() {
  const [profilesCount, credentialsCount, vehiclesCount, serviceEventsCount, appStateCount] = await Promise.all([
    db.profiles.count(),
    db.authCredentials.count(),
    db.vehicles.count(),
    db.serviceEvents.count(),
    db.appState.count(),
  ])

  return profilesCount + credentialsCount + vehiclesCount + serviceEventsCount + appStateCount > 0
}

async function migrateLegacyData() {
  if (await hasApplicationData()) {
    return
  }

  for (const legacyName of LEGACY_DB_NAMES) {
    const legacyDb = new LegacyDatabase(legacyName)

    try {
      await legacyDb.open()

      const [profiles, vehicles, serviceEvents, appState] = await Promise.all([
        legacyDb.profiles.toArray(),
        legacyDb.vehicles.toArray(),
        legacyDb.serviceEvents.toArray(),
        legacyDb.appState.toArray(),
      ])

      if (profiles.length + vehicles.length + serviceEvents.length + appState.length === 0) {
        continue
      }

      await db.transaction('rw', db.profiles, db.vehicles, db.serviceEvents, db.appState, async () => {
        if (profiles.length > 0) {
          await db.profiles.bulkPut(profiles)
        }
        if (vehicles.length > 0) {
          await db.vehicles.bulkPut(vehicles)
        }
        if (serviceEvents.length > 0) {
          await db.serviceEvents.bulkPut(serviceEvents)
        }
        if (appState.length > 0) {
          await db.appState.bulkPut(appState)
        }
      })

      return
    } catch {
      // Continue with the next legacy database candidate.
    } finally {
      legacyDb.close()
    }
  }
}

function isDemoProfile(profile: UserProfile) {
  return DEMO_PROFILE_IDS.has(profile.id) || DEMO_USERNAMES.has(profile.username.toLowerCase())
}

async function removeProfiles(profileIds: string[]) {
  if (profileIds.length === 0) {
    return
  }

  await db.transaction('rw', db.profiles, db.authCredentials, db.vehicles, db.serviceEvents, db.appState, async () => {
    const [vehicles, events, currentProfileId] = await Promise.all([
      db.vehicles.toArray(),
      db.serviceEvents.toArray(),
      db.appState.get(CURRENT_PROFILE_KEY),
    ])

    const scopedVehicleIds = vehicles.filter((vehicle) => profileIds.includes(vehicle.profileId)).map((vehicle) => vehicle.id)
    const scopedEventIds = events.filter((event) => profileIds.includes(event.profileId)).map((event) => event.id)

    if (scopedEventIds.length > 0) {
      await db.serviceEvents.bulkDelete(scopedEventIds)
    }

    if (scopedVehicleIds.length > 0) {
      await db.vehicles.bulkDelete(scopedVehicleIds)
    }

    await db.authCredentials.bulkDelete(profileIds)
    await db.profiles.bulkDelete(profileIds)

    if (currentProfileId?.value && profileIds.includes(currentProfileId.value)) {
      await db.appState.delete(CURRENT_PROFILE_KEY)
    }

    await db.appState.delete('seeded')
  })
}

async function removeDemoData() {
  const profiles = await db.profiles.toArray()
  const demoProfileIds = profiles.filter(isDemoProfile).map((profile) => profile.id)

  await removeProfiles(demoProfileIds)
}

async function removeProfilesWithoutCredentials() {
  const [profiles, credentials] = await Promise.all([db.profiles.toArray(), db.authCredentials.toArray()])
  const profileIdsWithCredentials = new Set(credentials.map((item) => item.profileId))
  const staleProfileIds = profiles.filter((profile) => !profileIdsWithCredentials.has(profile.id)).map((profile) => profile.id)

  await removeProfiles(staleProfileIds)
}

async function ensureCurrentProfileExists() {
  const currentProfileId = await db.appState.get(CURRENT_PROFILE_KEY)

  if (!currentProfileId?.value) {
    return
  }

  const [profile, credentials] = await Promise.all([db.profiles.get(currentProfileId.value), db.authCredentials.get(currentProfileId.value)])

  if (!profile || !credentials) {
    await db.appState.delete(CURRENT_PROFILE_KEY)
  }
}

export async function initializeDatabase() {
  await migrateLegacyData()
  await removeDemoData()
  await removeProfilesWithoutCredentials()
  await ensureCurrentProfileExists()
}

export async function resetDatabase() {
  await db.delete()
  await db.open()
}
