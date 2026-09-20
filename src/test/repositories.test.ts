import { describe, expect, it } from 'vitest'

import { db, initializeDatabase } from '@/data/database/db'
import { appStateRepository } from '@/data/repositories/app-state-repository'
import { profileRepository } from '@/data/repositories/profile-repository'
import { serviceEventRepository } from '@/data/repositories/service-event-repository'
import { vehicleRepository } from '@/data/repositories/vehicle-repository'
import { appAuthService } from '@/features/auth/app-auth-service'
import { createPasswordHash, verifyPassword } from '@/shared/lib/password'

describe('Repositories', () => {
  it('migrates legacy local login identifiers without changing passwords', async () => {
    const profileId = 'legacy-local-profile'
    const passwordData = await createPasswordHash('legacy-pass-1')
    const profileTimestamps = {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    await db.profiles.put({
      id: profileId,
      username: 'legacy-local',
      displayName: 'Legacy Local User',
      ...profileTimestamps,
    })
    await db.authCredentials.put({
      profileId,
      username: 'legacy-local',
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      ...profileTimestamps,
    })

    await initializeDatabase()

    const migratedCredential = await db.authCredentials.get(profileId)
    const migratedProfile = await db.profiles.get(profileId)

    expect(migratedProfile?.username).toBe('legacy-local@fura.info')
    expect(migratedCredential?.username).toBe('legacy-local@fura.info')
    expect(migratedCredential?.passwordHash).toBe(passwordData.hash)
    expect(migratedCredential?.passwordSalt).toBe(passwordData.salt)
    expect(await verifyPassword('legacy-pass-1', passwordData.salt, passwordData.hash)).toBe(true)
    expect((await appAuthService.login({ username: 'legacy-local@fura.info', password: 'legacy-pass-1' })).id).toBe(profileId)
  })

  it('filters vehicles by profileId', async () => {
    const primaryProfile = await profileRepository.create({ username: 'repo-1', displayName: 'Repo 1' })
    const secondaryProfile = await profileRepository.create({ username: 'repo-2', displayName: 'Repo 2' })

    await vehicleRepository.create(primaryProfile.id, {
      name: 'BMW 320d',
      make: 'BMW',
      model: '320d',
    })
    await vehicleRepository.create(primaryProfile.id, {
      name: 'Audi Q5',
      make: 'Audi',
      model: 'Q5',
    })
    await vehicleRepository.create(secondaryProfile.id, {
      name: 'Seat Leon',
      make: 'Seat',
      model: 'Leon',
    })

    const vehicles = await vehicleRepository.listByProfile(primaryProfile.id)

    expect(vehicles).toHaveLength(2)
    expect(vehicles.every((vehicle) => vehicle.profileId === primaryProfile.id)).toBe(true)
  })

  it('filters service events by profileId and vehicleId', async () => {
    const profile = await profileRepository.create({ username: 'repo-events', displayName: 'Repo Events' })
    const vehicle = await vehicleRepository.create(profile.id, {
      name: 'BMW 320d',
      make: 'BMW',
      model: '320d',
    })

    await serviceEventRepository.create(profile.id, vehicle.id, {
      status: 'completed',
      category: 'repair',
      title: 'Wymiana żarówki',
    })
    await serviceEventRepository.create(profile.id, vehicle.id, {
      status: 'planned',
      category: 'inspection',
      title: 'Przegląd okresowy',
    })

    const events = await serviceEventRepository.listByVehicle(profile.id, vehicle.id)

    expect(events.length).toBeGreaterThan(0)
    expect(events.every((event) => event.profileId === profile.id)).toBe(true)
    expect(events.every((event) => event.vehicleId === vehicle.id)).toBe(true)
  })

  it('persists added vehicle fields including custom image', async () => {
    const profile = await profileRepository.create({ username: 'repo-custom', displayName: 'Repo Custom' })
    const vehicle = await vehicleRepository.create(profile.id, {
      name: 'Skoda Octavia',
      make: 'Skoda',
      model: 'Octavia',
      year: 2022,
      bodyType: 'Kombi',
      fuelType: 'Diesel',
      transmission: 'Automat',
      engine: '2.0 TDI',
      power: 200,
      color: 'Grafitowy',
      registrationNumber: 'KR 2026A',
      currentMileage: 15500,
      imageUrl: 'data:image/png;base64,ZmFrZQ==',
      notes: 'Test vehicle',
    })

    const saved = await vehicleRepository.getById(vehicle.id)

    expect(saved?.power).toBe(200)
    expect(saved?.color).toBe('Grafitowy')
    expect(saved?.imageUrl).toBe('data:image/png;base64,ZmFrZQ==')
    expect(saved?.bodyType).toBe('Kombi')
    expect(saved?.transmission).toBe('Automat')
  })

  it('persists service attachment names', async () => {
    const profile = await profileRepository.create({ username: 'repo-attachments', displayName: 'Repo Attachments' })
    const vehicle = await vehicleRepository.create(profile.id, {
      name: 'BMW 320d',
      make: 'BMW',
      model: '320d',
    })
    const event = await serviceEventRepository.create(profile.id, vehicle.id, {
      status: 'completed',
      category: 'repair',
      title: 'Wymiana chłodnicy',
      laborCost: 450,
      partsCost: 600,
      otherCost: 50,
      attachmentCount: 2,
      attachmentNames: ['faktura.pdf', 'kosztorys.xlsx'],
      attachments: [
        { id: 'attachment-1', name: 'faktura.pdf', mimeType: 'application/pdf' },
        { id: 'attachment-2', name: 'kosztorys.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      ],
    })

    const saved = await serviceEventRepository.getById(event.id)

    expect(saved?.attachmentCount).toBe(2)
    expect(saved?.attachmentNames).toEqual(['faktura.pdf', 'kosztorys.xlsx'])
    expect(saved?.attachments).toEqual([
      { id: 'attachment-1', name: 'faktura.pdf', mimeType: 'application/pdf' },
      { id: 'attachment-2', name: 'kosztorys.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    ])
  })

  it('persists selected workshop location', async () => {
    const profile = await profileRepository.create({ username: 'repo-location', displayName: 'Repo Location' })
    const vehicle = await vehicleRepository.create(profile.id, {
      name: 'Toyota Corolla',
      make: 'Toyota',
      model: 'Corolla',
    })

    const event = await serviceEventRepository.create(profile.id, vehicle.id, {
      status: 'completed',
      category: 'repair',
      title: 'Naprawa ukladu klimatyzacji',
      workshopName: 'Moto Klima',
      workshopLocation: {
        placeId: 'sample-place-id',
        label: 'Moto Klima',
        address: 'ul. Testowa 1, Krakow',
        lat: 50.06143,
        lng: 19.93658,
      },
    })

    const saved = await serviceEventRepository.getById(event.id)

    expect(saved?.workshopLocation).toEqual({
      placeId: 'sample-place-id',
      label: 'Moto Klima',
      address: 'ul. Testowa 1, Krakow',
      lat: 50.06143,
      lng: 19.93658,
    })
  })

  it('persists planned service recurrence settings', async () => {
    const profile = await profileRepository.create({ username: 'repo-planned', displayName: 'Repo Planned' })
    const vehicle = await vehicleRepository.create(profile.id, {
      name: 'BMW 320d',
      make: 'BMW',
      model: '320d',
    })
    const event = await serviceEventRepository.create(profile.id, vehicle.id, {
      status: 'planned',
      category: 'periodic_service',
      title: 'Wymiana oleju',
      mileage: 180000,
      isRecurring: true,
      recurrenceType: 'time',
      recurrenceIntervalValue: 6,
      recurrenceIntervalUnit: 'months',
    })

    const saved = await serviceEventRepository.getById(event.id)

    expect(saved?.isRecurring).toBe(true)
    expect(saved?.recurrenceType).toBe('time')
    expect(saved?.recurrenceIntervalValue).toBe(6)
    expect(saved?.recurrenceIntervalUnit).toBe('months')
  })

  it('removes vehicle together with its service history', async () => {
    const profile = await profileRepository.create({ username: 'repo-delete-vehicle', displayName: 'Repo Delete Vehicle' })
    const vehicle = await vehicleRepository.create(profile.id, {
      name: 'Opel Astra',
      make: 'Opel',
      model: 'Astra',
    })

    await serviceEventRepository.create(profile.id, vehicle.id, {
      status: 'completed',
      category: 'repair',
      title: 'Wymiana klockow hamulcowych',
    })

    await vehicleRepository.remove(vehicle.id)

    const [savedVehicle, events] = await Promise.all([
      vehicleRepository.getById(vehicle.id),
      serviceEventRepository.listByVehicle(profile.id, vehicle.id),
    ])

    expect(savedVehicle).toBeNull()
    expect(events).toHaveLength(0)
  })

  it('removes the complete local account including attachments and profile state', async () => {
    const { accountRepository } = await import('@/data/repositories/account-repository')
    const profile = await appAuthService.register({
      username: 'repo-delete-account@example.com',
      displayName: 'Repo Delete Account',
      password: 'secret123',
      termsAccepted: true,
    })
    const vehicle = await vehicleRepository.create(profile.id, {
      name: 'Volvo V60',
      make: 'Volvo',
      model: 'V60',
      imageUrl: 'data:image/png;base64,ZmFrZQ==',
    })
    const event = await serviceEventRepository.create(profile.id, vehicle.id, {
      status: 'completed',
      category: 'repair',
      title: 'Naprawa',
      attachments: [{ id: 'attachment-account', name: 'rachunek.png', previewUrl: 'data:image/png;base64,ZmFrZQ==' }],
    })

    await appStateRepository.setCurrentVehicleId(profile.id, vehicle.id)
    await accountRepository.deleteByProfileId(profile.id)

    expect(await db.profiles.get(profile.id)).toBeUndefined()
    expect(await db.authCredentials.get(profile.id)).toBeUndefined()
    expect(await db.vehicles.get(vehicle.id)).toBeUndefined()
    expect(await db.serviceEvents.get(event.id)).toBeUndefined()
    expect(await appStateRepository.getCurrentProfileId()).toBeNull()
    expect(await appStateRepository.getCurrentVehicleId(profile.id)).toBeNull()
  })
})
