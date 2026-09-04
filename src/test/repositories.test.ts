import { describe, expect, it } from 'vitest'

import { serviceEventRepository } from '@/data/repositories/service-event-repository'
import { vehicleRepository } from '@/data/repositories/vehicle-repository'

describe('Repositories', () => {
  it('filters vehicles by profileId', async () => {
    const vehicles = await vehicleRepository.listByProfile('profile-demo-main')

    expect(vehicles).toHaveLength(2)
    expect(vehicles.every((vehicle) => vehicle.profileId === 'profile-demo-main')).toBe(true)
  })

  it('filters service events by profileId and vehicleId', async () => {
    const events = await serviceEventRepository.listByVehicle('profile-demo-main', 'vehicle-bmw-320d')

    expect(events.length).toBeGreaterThan(0)
    expect(events.every((event) => event.profileId === 'profile-demo-main')).toBe(true)
    expect(events.every((event) => event.vehicleId === 'vehicle-bmw-320d')).toBe(true)
  })

  it('persists added vehicle fields including custom image', async () => {
    const vehicle = await vehicleRepository.create('profile-demo-main', {
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
    const event = await serviceEventRepository.create('profile-demo-main', 'vehicle-bmw-320d', {
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
    const event = await serviceEventRepository.create('profile-demo-main', 'vehicle-bmw-320d', {
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
})
