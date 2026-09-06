import type { ServiceEvent, Vehicle } from '@/shared/types/domain'

const currencyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const mileageFormatter = new Intl.NumberFormat('pl-PL')

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function formatMileage(value?: number) {
  if (value === undefined) {
    return 'Brak danych'
  }

  return `${mileageFormatter.format(value)} km`
}

export function formatDate(value?: string) {
  if (!value) {
    return 'Bez daty'
  }

  return dateFormatter.format(new Date(value))
}

export function getEventTotalCost(event: ServiceEvent) {
  return (event.partsCost ?? 0) + (event.laborCost ?? 0) + (event.otherCost ?? 0)
}

export function getVehicleSubtitle(vehicle: Vehicle) {
  return [vehicle.year, vehicle.bodyType, vehicle.fuelType, vehicle.transmission]
    .filter(Boolean)
    .join(' • ')
}

export function sortEventsDesc(events: ServiceEvent[]) {
  return [...events].sort((left, right) => {
    const rightDate = right.eventDate ? new Date(right.eventDate).getTime() : 0
    const leftDate = left.eventDate ? new Date(left.eventDate).getTime() : 0

    if (rightDate !== leftDate) {
      return rightDate - leftDate
    }

    return (right.mileage ?? 0) - (left.mileage ?? 0)
  })
}

export function sortEventsAsc(events: ServiceEvent[]) {
  return [...events].sort((left, right) => {
    const leftDate = left.eventDate ? new Date(left.eventDate).getTime() : Number.MAX_SAFE_INTEGER
    const rightDate = right.eventDate ? new Date(right.eventDate).getTime() : Number.MAX_SAFE_INTEGER

    if (leftDate !== rightDate) {
      return leftDate - rightDate
    }

    return (left.mileage ?? Number.MAX_SAFE_INTEGER) - (right.mileage ?? Number.MAX_SAFE_INTEGER)
  })
}

export function getPlannedEventUrgency(event: ServiceEvent, currentMileage?: number) {
  const now = new Date()
  const eventTime = event.eventDate ? new Date(event.eventDate).getTime() : undefined

  if ((eventTime !== undefined && eventTime < now.getTime()) || (event.mileage !== undefined && currentMileage !== undefined && event.mileage <= currentMileage)) {
    return 'overdue' as const
  }

  if (
    (eventTime !== undefined && eventTime - now.getTime() <= 1000 * 60 * 60 * 24 * 30) ||
    (event.mileage !== undefined && currentMileage !== undefined && event.mileage - currentMileage <= 1500)
  ) {
    return 'urgent' as const
  }

  return 'upcoming' as const
}
