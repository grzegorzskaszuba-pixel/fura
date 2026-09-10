import { db } from '@/data/database/db'
import { appConfig } from '@/shared/config/app-config'
import { HttpError, httpRequest } from '@/shared/lib/http-client'
import { generateId } from '@/shared/lib/utils'
import type { ServiceEvent, ServiceEventFormValues } from '@/shared/types/domain'

const serviceEventsBaseUrl = `${appConfig.apiBaseUrl}/service-events`

function isRemoteMode() {
  return appConfig.authMode === 'remote'
}

function toServiceEventPayload(input: ServiceEventFormValues) {
  return {
    status: input.status,
    category: input.category,
    title: input.title.trim(),
    eventDate: input.eventDate,
    mileage: input.mileage,
    description: input.description?.trim(),
    workshopName: input.workshopName?.trim(),
    workshopLocation: input.workshopLocation,
    partsCost: input.partsCost,
    laborCost: input.laborCost,
    otherCost: input.otherCost,
    attachmentCount: input.attachmentCount,
    attachmentNames: input.attachmentNames,
    attachments: input.attachments,
    isRecurring: input.isRecurring,
    recurrenceType: input.recurrenceType,
    recurrenceIntervalValue: input.recurrenceIntervalValue,
    recurrenceIntervalUnit: input.recurrenceIntervalUnit,
    recurrenceMileageInterval: input.recurrenceMileageInterval,
  }
}

export const serviceEventRepository = {
  async listByVehicle(profileId: string, vehicleId: string) {
    if (!isRemoteMode()) {
      const events = await db.serviceEvents.where('[profileId+vehicleId]').equals([profileId, vehicleId]).toArray()
      return events
        .filter((event) => event.status !== 'cancelled')
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    }

    const response = await httpRequest<{ events: ServiceEvent[] }>(`${serviceEventsBaseUrl}?vehicleId=${encodeURIComponent(vehicleId)}`)
    return response.events.filter((event) => event.profileId === profileId && event.vehicleId === vehicleId)
  },

  async syncByVehicle(profileId: string, vehicleId: string) {
    void profileId
    void vehicleId
    return
  },

  async getById(id: string): Promise<ServiceEvent | null> {
    if (!isRemoteMode()) {
      return (await db.serviceEvents.get(id)) ?? null
    }

    try {
      const response = await httpRequest<{ event: ServiceEvent }>(`${serviceEventsBaseUrl}/${id}`)
      return response.event
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return null
      }

      throw error
    }
  },

  async create(profileId: string, vehicleId: string, input: ServiceEventFormValues) {
    if (!isRemoteMode()) {
      const now = new Date().toISOString()
      const event: ServiceEvent = {
        id: `event-${generateId()}`,
        profileId,
        vehicleId,
        currency: 'PLN',
        createdAt: now,
        updatedAt: now,
        ...toServiceEventPayload(input),
      }

      await db.serviceEvents.add(event)
      return event
    }

    void profileId
    const response = await httpRequest<{ event: ServiceEvent }>(serviceEventsBaseUrl, {
      method: 'POST',
      body: {
        vehicleId,
        ...toServiceEventPayload(input),
      },
    })

    return response.event
  },

  async update(eventId: string, input: ServiceEventFormValues) {
    if (!isRemoteMode()) {
      const existing = await db.serviceEvents.get(eventId)

      if (!existing) {
        throw new Error('Wpis serwisowy nie istnieje')
      }

      const updatedEvent: ServiceEvent = {
        ...existing,
        ...toServiceEventPayload(input),
        updatedAt: new Date().toISOString(),
      }

      await db.serviceEvents.put(updatedEvent)
      return updatedEvent
    }

    const response = await httpRequest<{ event: ServiceEvent }>(`${serviceEventsBaseUrl}/${eventId}`, {
      method: 'PUT',
      body: toServiceEventPayload(input),
    })

    return response.event
  },

  async remove(eventId: string) {
    if (!isRemoteMode()) {
      await db.serviceEvents.delete(eventId)
      return
    }

    await httpRequest<void>(`${serviceEventsBaseUrl}/${eventId}`, {
      method: 'DELETE',
    })
  },
}
