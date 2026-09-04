import { db } from '@/data/database/db'
import { generateId } from '@/shared/lib/utils'
import type { ServiceEvent, ServiceEventFormValues } from '@/shared/types/domain'

export const serviceEventRepository = {
  async listByVehicle(profileId: string, vehicleId: string) {
    return db.serviceEvents
      .where('[profileId+vehicleId]')
      .equals([profileId, vehicleId])
      .toArray()
  },

  async getById(id: string) {
    return db.serviceEvents.get(id)
  },

  async create(profileId: string, vehicleId: string, input: ServiceEventFormValues) {
    const now = new Date().toISOString()
    const event: ServiceEvent = {
      id: generateId(),
      profileId,
      vehicleId,
      status: input.status,
      category: input.category,
      title: input.title.trim(),
      eventDate: input.eventDate,
      mileage: input.mileage,
      description: input.description?.trim(),
      workshopName: input.workshopName?.trim(),
      partsCost: input.partsCost,
      laborCost: input.laborCost,
      otherCost: input.otherCost,
      currency: 'PLN',
      attachmentCount: input.attachmentCount,
      attachmentNames: input.attachmentNames,
      attachments: input.attachments,
      isRecurring: input.isRecurring,
      recurrenceType: input.recurrenceType,
      recurrenceIntervalValue: input.recurrenceIntervalValue,
      recurrenceIntervalUnit: input.recurrenceIntervalUnit,
      recurrenceMileageInterval: input.recurrenceMileageInterval,
      createdAt: now,
      updatedAt: now,
    }

    await db.serviceEvents.add(event)
    return event
  },

  async update(eventId: string, input: ServiceEventFormValues) {
    const existing = await db.serviceEvents.get(eventId)

    if (!existing) {
      throw new Error('Service event not found')
    }

    const updated: ServiceEvent = {
      ...existing,
      ...input,
      title: input.title.trim(),
      description: input.description?.trim(),
      workshopName: input.workshopName?.trim(),
      attachmentNames: input.attachmentNames,
      attachments: input.attachments,
      isRecurring: input.isRecurring,
      recurrenceType: input.recurrenceType,
      recurrenceIntervalValue: input.recurrenceIntervalValue,
      recurrenceIntervalUnit: input.recurrenceIntervalUnit,
      recurrenceMileageInterval: input.recurrenceMileageInterval,
      updatedAt: new Date().toISOString(),
      currency: 'PLN',
    }

    await db.serviceEvents.put(updated)
    return updated
  },

  async remove(eventId: string) {
    await db.serviceEvents.delete(eventId)
  },
}
