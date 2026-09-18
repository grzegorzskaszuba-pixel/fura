import { db } from '@/data/database/db'
import { appStateRepository } from '@/data/repositories/app-state-repository'

const CURRENT_PROFILE_KEY = 'currentProfileId'

function getActiveVehicleKey(profileId: string) {
  return `activeVehicle:${profileId}`
}

export const accountRepository = {
  async deleteByProfileId(profileId: string) {
    await db.transaction('rw', db.profiles, db.authCredentials, db.vehicles, db.serviceEvents, db.appState, async () => {
      const profile = await db.profiles.get(profileId)

      if (!profile) {
        throw new Error('Profil nie istnieje')
      }

      const [vehicleIds, eventIds] = await Promise.all([
        db.vehicles.where('profileId').equals(profileId).primaryKeys(),
        db.serviceEvents.where('profileId').equals(profileId).primaryKeys(),
      ])

      if (eventIds.length > 0) {
        await db.serviceEvents.bulkDelete(eventIds)
      }

      if (vehicleIds.length > 0) {
        await db.vehicles.bulkDelete(vehicleIds)
      }

      await db.authCredentials.delete(profileId)
      await db.profiles.delete(profileId)
      await db.appState.bulkDelete([CURRENT_PROFILE_KEY, getActiveVehicleKey(profileId)])
    })

    const currentProfileId = await appStateRepository.getCurrentProfileId()

    if (currentProfileId === profileId) {
      await appStateRepository.setCurrentProfileId(null)
    }

    await appStateRepository.setCurrentVehicleId(profileId, null)
  },
}