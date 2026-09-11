const CURRENT_PROFILE_KEY = 'currentProfileId'

function getActiveVehicleKey(profileId: string) {
  return `activeVehicle:${profileId}`
}

function readStorage(key: string) {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(key)
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  const currentValue = window.localStorage.getItem(key)

  if (value === currentValue) {
    return
  }

  if (value === null) {
    window.localStorage.removeItem(key)
    return
  }

  window.localStorage.setItem(key, value)
}

export const appStateRepository = {
  async getCurrentProfileId() {
    return readStorage(CURRENT_PROFILE_KEY)
  },

  async setCurrentProfileId(profileId: string | null) {
    writeStorage(CURRENT_PROFILE_KEY, profileId)
  },

  async getCurrentVehicleId(profileId: string) {
    return readStorage(getActiveVehicleKey(profileId))
  },

  async setCurrentVehicleId(profileId: string, vehicleId: string | null) {
    writeStorage(getActiveVehicleKey(profileId), vehicleId)
  },
}
