// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { changePassword, loginProfile, registerProfile, resetPassword } from '../auth-core.mjs'

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
      username: 'DriverOne',
      displayName: 'Driver One',
      password: 'secret123',
    })

    expect(profile.username).toBe('driverone')
    expect(state.profiles).toHaveLength(1)
    expect(state.credentials).toHaveLength(1)

    const loggedIn = loginProfile(state, {
      username: 'driverone',
      password: 'secret123',
    })

    expect(loggedIn.id).toBe(profile.id)
  })

  it('changes password only with valid current password', () => {
    const state = createState()

    const profile = registerProfile(state, {
      username: 'owner',
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
        username: 'owner',
        password: 'old-pass-1',
      }),
    ).toThrow('Nieprawidłowe hasło')

    const loggedIn = loginProfile(state, {
      username: 'owner',
      password: 'new-pass-1',
    })

    expect(loggedIn.id).toBe(profile.id)
  })

  it('resets password for known username', () => {
    const state = createState()

    registerProfile(state, {
      username: 'recoverable',
      displayName: 'Recoverable',
      password: 'start-pass-1',
    })

    resetPassword(state, {
      username: 'recoverable',
      password: 'reset-pass-1',
    })

    const loggedIn = loginProfile(state, {
      username: 'recoverable',
      password: 'reset-pass-1',
    })

    expect(loggedIn.username).toBe('recoverable')
  })
})
