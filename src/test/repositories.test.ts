import { describe, expect, it } from 'vitest'

import { profileRepository } from '@/data/repositories/profile-repository'
import { serviceEventRepository } from '@/data/repositories/service-event-repository'
import { vehicleRepository } from '@/data/repositories/vehicle-repository'

describe('Repositories', () => {
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
})
