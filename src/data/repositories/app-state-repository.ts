import { db } from '@/data/database/db'

const CURRENT_PROFILE_KEY = 'currentProfileId'

function getActiveVehicleKey(profileId: string) {
  return `activeVehicle:${profileId}`
}

export const appStateRepository = {
  async getCurrentProfileId() {
    return (await db.appState.get(CURRENT_PROFILE_KEY))?.value ?? null
  },

  async setCurrentProfileId(profileId: string | null) {
    if (!profileId) {
      await db.appState.delete(CURRENT_PROFILE_KEY)
      return
    }

    await db.appState.put({ key: CURRENT_PROFILE_KEY, value: profileId })
  },

  async getCurrentVehicleId(profileId: string) {
    return (await db.appState.get(getActiveVehicleKey(profileId)))?.value ?? null
  },

  async setCurrentVehicleId(profileId: string, vehicleId: string | null) {
    const key = getActiveVehicleKey(profileId)

    if (!vehicleId) {
      await db.appState.delete(key)
      return
    }

    await db.appState.put({ key, value: vehicleId })
  },
}
