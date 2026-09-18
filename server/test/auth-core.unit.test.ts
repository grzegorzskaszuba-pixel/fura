// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { changePassword, loginProfile, migrateAuthState, registerProfile, removeProfileData, resetPassword } from '../auth-core.mjs'

interface AuthState {
  profiles: Array<{
    id: string
    username: string
    displayName: string
    createdAt: string
    updatedAt: string
  }>
  credentials: Array<{
    profileId: string
    username: string
    passwordHash: string
    passwordSalt: string
    createdAt: string
    updatedAt: string
  }>
  vehicles: unknown[]
  serviceEvents: unknown[]
}

function createState(): AuthState {
  return {
    profiles: [],
    credentials: [],
    vehicles: [],
    serviceEvents: [],
  }
}

describe('auth-core unit', () => {
  it('registers a new profile and allows login', () => {
    const state = createState()

    const profile = registerProfile(state, {
      username: 'DriverOne@example.com',
      displayName: 'Driver One',
      password: 'secret123',
    })

    expect(profile.username).toBe('driverone@example.com')
    expect(state.profiles).toHaveLength(1)
    expect(state.credentials).toHaveLength(1)

    const loggedIn = loginProfile(state, {
      username: 'driverone@example.com',
      password: 'secret123',
    })

    expect(loggedIn.id).toBe(profile.id)
  })

  it('changes password only with valid current password', () => {
    const state = createState()

    const profile = registerProfile(state, {
      username: 'owner@example.com',
      displayName: 'Owner',
      password: 'old-pass-1',
    })

    expect(() =>
      changePassword(state, {
        profileId: profile.id,
        currentPassword: 'wrong-pass',
        newPassword: 'new-pass-1',
      }),
    ).toThrow('Nieprawidłowe obecne hasło')

    changePassword(state, {
      profileId: profile.id,
      currentPassword: 'old-pass-1',
      newPassword: 'new-pass-1',
    })

    expect(() =>
      loginProfile(state, {
        username: 'owner@example.com',
        password: 'old-pass-1',
      }),
    ).toThrow('Nieprawidłowe hasło')

    const loggedIn = loginProfile(state, {
      username: 'owner@example.com',
      password: 'new-pass-1',
    })

    expect(loggedIn.id).toBe(profile.id)
  })

  it('resets password for known username', () => {
    const state = createState()

    registerProfile(state, {
      username: 'recoverable@example.com',
      displayName: 'Recoverable',
      password: 'start-pass-1',
    })

    resetPassword(state, {
      username: 'recoverable@example.com',
      password: 'reset-pass-1',
    })

    const loggedIn = loginProfile(state, {
      username: 'recoverable@example.com',
      password: 'reset-pass-1',
    })

    expect(loggedIn.username).toBe('recoverable@example.com')
  })

  it('migrates legacy usernames without changing password hashes', () => {
    const state = createState()
    const profile = registerProfile(state, {
      username: 'legacy@example.com',
      displayName: 'Legacy User',
      password: 'legacy-pass-1',
    })
    const credential = state.credentials[0]
    const originalHash = credential.passwordHash
    const originalSalt = credential.passwordSalt

    state.profiles[0].username = 'legacy'
    credential.username = 'legacy'

    expect(migrateAuthState(state)).toBe(true)
    expect(state.profiles[0].username).toBe('legacy@fura.info')
    expect(credential.username).toBe('legacy@fura.info')
    expect(credential.passwordHash).toBe(originalHash)
    expect(credential.passwordSalt).toBe(originalSalt)
    expect(loginProfile(state, { username: 'legacy@fura.info', password: 'legacy-pass-1' }).id).toBe(profile.id)
  })

  it('migrates an existing Gmail login when the user logs in with the Fura domain', () => {
    const state = createState()
    const profile = registerProfile(state, {
      username: 'bigdaddysatan@gmail.com',
      displayName: 'Big Daddy Satan',
      password: 'legacy-pass-2',
    })
    const credential = state.credentials[0]
    const originalHash = credential.passwordHash
    const originalSalt = credential.passwordSalt

    const loggedIn = loginProfile(state, {
      username: 'bigdaddysatan@fura.info',
      password: 'legacy-pass-2',
    })

    expect(loggedIn.id).toBe(profile.id)
    expect(state.profiles[0].username).toBe('bigdaddysatan@fura.info')
    expect(credential.username).toBe('bigdaddysatan@fura.info')
    expect(credential.passwordHash).toBe(originalHash)
    expect(credential.passwordSalt).toBe(originalSalt)
  })

  it('rejects non-email registration identifiers', () => {
    const state = createState()

    expect(() =>
      registerProfile(state, {
        username: 'legacy-user',
        displayName: 'Legacy User',
        password: 'secret123',
      }),
    ).toThrow('Podaj prawidłowy adres e-mail')
  })

  it('removes every profile-owned record including shared brochure data', () => {
    const state = createState() as AuthState & { shareBrochures: Array<{ profileId: string }> }
    state.shareBrochures = []

    const profile = registerProfile(state, {
      username: 'deletable@example.com',
      displayName: 'Deletable User',
      password: 'secret123',
    })

    state.vehicles.push({ profileId: profile.id })
    state.serviceEvents.push({ profileId: profile.id })
    state.shareBrochures.push({ profileId: profile.id })
    state.vehicles.push({ profileId: 'other-profile' })
    state.serviceEvents.push({ profileId: 'other-profile' })
    state.shareBrochures.push({ profileId: 'other-profile' })

    expect(removeProfileData(state, profile.id)).toBe(true)
    expect(state.profiles).toHaveLength(0)
    expect(state.credentials).toHaveLength(0)
    expect(state.vehicles).toEqual([{ profileId: 'other-profile' }])
    expect(state.serviceEvents).toEqual([{ profileId: 'other-profile' }])
    expect(state.shareBrochures).toEqual([{ profileId: 'other-profile' }])
  })
})
