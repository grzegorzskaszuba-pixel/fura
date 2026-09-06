import { db } from '@/data/database/db'
import { appConfig } from '@/shared/config/app-config'
import { httpRequest } from '@/shared/lib/http-client'
import { generateId } from '@/shared/lib/utils'
import type { Vehicle, VehicleFormValues } from '@/shared/types/domain'

const vehiclesBaseUrl = `${appConfig.apiBaseUrl}/vehicles`

function isRemoteMode() {
  return appConfig.authMode === 'remote'
}

function toVehicleFormValues(input: VehicleFormValues) {
  return {
    name: input.name.trim(),
    make: input.make.trim(),
    model: input.model.trim(),
    year: input.year,
    bodyType: input.bodyType?.trim(),
    fuelType: input.fuelType?.trim(),
    transmission: input.transmission?.trim(),
    engine: input.engine?.trim(),
    power: input.power,
    color: input.color?.trim(),
    vin: input.vin?.trim(),
    registrationNumber: input.registrationNumber?.trim(),
    currentMileage: input.currentMileage,
    imageUrl: input.imageUrl?.trim(),
    notes: input.notes?.trim(),
  }
}

export const vehicleRepository = {
  async listByProfile(profileId: string) {
    if (!isRemoteMode()) {
      const vehicles = await db.vehicles.where('profileId').equals(profileId).toArray()
      return vehicles
        .filter((vehicle) => !vehicle.archived)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    }

    const response = await httpRequest<{ vehicles: Vehicle[] }>(vehiclesBaseUrl)
    return response.vehicles.filter((vehicle) => vehicle.profileId === profileId && !vehicle.archived)
  },

  async syncByProfile(profileId: string) {
    void profileId
    return
  },

  async getById(id: string) {
    if (!isRemoteMode()) {
      return (await db.vehicles.get(id)) ?? null
    }

    const response = await httpRequest<{ vehicles: Vehicle[] }>(vehiclesBaseUrl)
    return response.vehicles.find((vehicle) => vehicle.id === id) ?? null
  },

  async create(profileId: string, input: VehicleFormValues) {
    if (!isRemoteMode()) {
      const now = new Date().toISOString()
      const vehicle: Vehicle = {
        id: `vehicle-${generateId()}`,
        profileId,
        archived: false,
        createdAt: now,
        updatedAt: now,
        ...toVehicleFormValues(input),
      }

      await db.vehicles.add(vehicle)
      return vehicle
    }

    void profileId
    const response = await httpRequest<{ vehicle: Vehicle }>(vehiclesBaseUrl, {
      method: 'POST',
      body: toVehicleFormValues(input),
    })

    return response.vehicle
  },

  async update(vehicleId: string, input: VehicleFormValues) {
    if (!isRemoteMode()) {
      const existing = await db.vehicles.get(vehicleId)

      if (!existing) {
        throw new Error('Pojazd nie istnieje')
      }

      const updatedVehicle: Vehicle = {
        ...existing,
        ...toVehicleFormValues(input),
        updatedAt: new Date().toISOString(),
      }

      await db.vehicles.put(updatedVehicle)
      return updatedVehicle
    }

    const response = await httpRequest<{ vehicle: Vehicle }>(`${vehiclesBaseUrl}/${vehicleId}`, {
      method: 'PUT',
      body: toVehicleFormValues(input),
    })

    return response.vehicle
  },
}
