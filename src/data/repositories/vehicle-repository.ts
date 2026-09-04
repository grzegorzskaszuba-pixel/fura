import { db } from '@/data/database/db'
import { generateId } from '@/shared/lib/utils'
import type { Vehicle, VehicleFormValues } from '@/shared/types/domain'

export const vehicleRepository = {
  async listByProfile(profileId: string) {
    return db.vehicles
      .where('profileId')
      .equals(profileId)
      .filter((vehicle) => !vehicle.archived)
      .sortBy('updatedAt')
  },

  async getById(id: string) {
    return db.vehicles.get(id)
  },

  async create(profileId: string, input: VehicleFormValues) {
    const now = new Date().toISOString()
    const vehicle: Vehicle = {
      id: generateId(),
      profileId,
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
      archived: false,
      createdAt: now,
      updatedAt: now,
    }

    await db.vehicles.add(vehicle)
    return vehicle
  },

  async update(vehicleId: string, input: VehicleFormValues) {
    const existing = await db.vehicles.get(vehicleId)

    if (!existing) {
      throw new Error('Vehicle not found')
    }

    const updated: Vehicle = {
      ...existing,
      ...input,
      name: input.name.trim(),
      make: input.make.trim(),
      model: input.model.trim(),
      bodyType: input.bodyType?.trim(),
      fuelType: input.fuelType?.trim(),
      transmission: input.transmission?.trim(),
      engine: input.engine?.trim(),
      color: input.color?.trim(),
      imageUrl: input.imageUrl?.trim(),
      vin: input.vin?.trim(),
      registrationNumber: input.registrationNumber?.trim(),
      notes: input.notes?.trim(),
      updatedAt: new Date().toISOString(),
    }

    await db.vehicles.put(updated)
    return updated
  },
}
