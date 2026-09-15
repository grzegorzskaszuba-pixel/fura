import {
  CalendarDays,
  CircleDashed,
  FileText,
  Gauge,
  Paperclip,
  Paintbrush2,
  ReceiptText,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useRef } from 'react'

import { EmptyState } from '@/shared/components/empty-state'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { serviceCategoryLabels } from '@/shared/constants/service-categories'
import { formatCurrency, formatDate, formatMileage, getEventTotalCost, getPlannedEventUrgency } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import type { ServiceCategory, ServiceEvent, ServiceTab, Vehicle } from '@/shared/types/domain'

const iconMap: Record<ServiceCategory, typeof Wrench> = {
  inspection: CalendarDays,
  periodic_service: Wrench,
  diagnostics: CircleDashed,
  repair: ShieldAlert,
  oil_fluids: Wrench,
  brakes: ShieldAlert,
  tires_wheels: CircleDashed,
  suspension_steering: Gauge,
  engine_drivetrain: Wrench,
  electrical: CircleDashed,
  body_paint: Paintbrush2,
  detailing: Sparkles,
  tuning: Gauge,
  documents: FileText,
  other: ReceiptText,
}

interface ServiceEventListProps {
  tab: ServiceTab
  vehicle: Vehicle
  events: ServiceEvent[]
  isLoading: boolean
  onTabChange: (tab: ServiceTab) => void
  onEventClick: (event: ServiceEvent) => void
}

function getMileageIncrease(currentMileage?: number, previousMileage?: number) {
  if (currentMileage === undefined || previousMileage === undefined) {
    return null
  }

  const increase = currentMileage - previousMileage
  return increase > 0 ? increase : null
}

export function ServiceEventList({ tab, vehicle, events, isLoading, onTabChange, onEventClick }: ServiceEventListProps) {
  const touchStartX = useRef<number | null>(null)

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) {
      return
    }

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current
    const delta = endX - touchStartX.current

    if (Math.abs(delta) > 40) {
      onTabChange(delta > 0 ? 'history' : 'plan')
    }

    touchStartX.current = null
  }

  function handleEventKeyDown(event: React.KeyboardEvent<HTMLDivElement>, serviceEvent: ServiceEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onEventClick(serviceEvent)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-center rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-200/80">
        {([
          { value: 'history', mobileLabel: 'Historia', desktopLabel: 'Historia serwisowa' },
          { value: 'plan', mobileLabel: 'Plan', desktopLabel: 'Plan serwisowy' },
        ] as const).map((item) => (
          <button
            key={item.value}
            type="button"
            data-testid={`tab-${item.value}`}
            aria-pressed={tab === item.value}
            className={cn(
              'w-full rounded-full px-4 py-3 text-sm font-medium transition sm:text-base',
              tab === item.value ? 'bg-zinc-950 text-white' : 'text-zinc-500',
            )}
            onClick={() => onTabChange(item.value)}
          >
            <span className="sm:hidden">{item.mobileLabel}</span>
            <span className="hidden sm:inline">{item.desktopLabel}</span>
          </button>
        ))}
      </div>

      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {isLoading ? (
          <EmptyState
            icon={
              <span className="relative inline-flex h-10 w-10 items-center justify-center" aria-hidden="true">
                <span className="absolute inset-[-6px] rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
                <Wrench className="h-6 w-6" />
              </span>
            }
            title={tab === 'history' ? 'Ładowanie historii serwisowej...' : 'Ładowanie planu serwisowego...'}
            description={`Pobieram wpisy dla ${vehicle.name}`}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-6 w-6" />}
            title={tab === 'history' ? 'Brak historii serwisowej' : 'Brak zaplanowanych serwisów'}
            description={tab === 'history' ? 'Dodaj pierwszy wykonany serwis dla tego auta.' : 'Zaplanuj najbliższy serwis i wróć do niego później.'}
          />
        ) : (
          <Card className="overflow-hidden bg-white/94">
            <CardContent className="p-0">
              <div className="relative">
                <div className="divide-y divide-zinc-100">
                  {events.map((event, index) => {
                    const Icon = iconMap[event.category]
                    const urgency = event.status === 'planned' ? getPlannedEventUrgency(event, vehicle.currentMileage) : null
                    const mileageIncrease = tab === 'history' ? getMileageIncrease(event.mileage, events[index + 1]?.mileage) : null

                    return (
                      <div
                        key={event.id}
                        role="button"
                        tabIndex={0}
                        data-testid={`service-event-${event.id}`}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3 text-left transition hover:bg-zinc-50 sm:grid-cols-[70px_180px_minmax(0,1fr)_max-content_max-content] sm:gap-4 sm:px-6 sm:py-4"
                        onClick={() => onEventClick(event)}
                        onKeyDown={(keyboardEvent) => handleEventKeyDown(keyboardEvent, event)}
                      >
                        <div className="hidden sm:flex sm:items-start sm:justify-center">
                          <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 ring-8 ring-white">
                            <Icon className="h-5 w-5" />
                          </span>
                        </div>
                        <div className="hidden space-y-1 sm:block">
                          <p className="text-sm font-semibold text-zinc-950">{formatDate(event.eventDate)}</p>
                          <p className="flex items-center gap-1 whitespace-nowrap text-sm text-zinc-500">
                            <span>{formatMileage(event.mileage)}</span>
                            {mileageIncrease !== null ? <span className="text-primary">(+ {formatMileage(mileageIncrease)})</span> : null}
                          </p>
                        </div>
                        <div className="min-w-0 space-y-1 sm:space-y-1.5">
                          <div className="flex items-center gap-3 sm:hidden">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                              <Icon className="h-4 w-4" />
                            </span>
                            <p className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.03em] text-zinc-950">{event.title}</p>
                            {urgency === 'overdue' ? <Badge variant="danger">Zaległy</Badge> : null}
                            {urgency === 'urgent' ? <Badge variant="warning">Pilny</Badge> : null}
                            {urgency === 'upcoming' ? <Badge variant="accent">Nadchodzący</Badge> : null}
                          </div>
                          <p className="hidden text-lg font-semibold tracking-[-0.03em] text-zinc-950 sm:block">{event.title}</p>
                          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 sm:hidden">
                            <span className="font-medium text-zinc-700">{formatDate(event.eventDate)}</span>
                            <span className="text-zinc-300">•</span>
                            <span>{formatMileage(event.mileage)}</span>
                            {mileageIncrease !== null ? <span className="text-primary">(+ {formatMileage(mileageIncrease)})</span> : null}
                          </div>
                          <p className="truncate text-xs text-zinc-500 sm:text-sm">{event.description || serviceCategoryLabels[event.category]}</p>
                        </div>
                        <div className="hidden items-center justify-end sm:flex">
                          {urgency === 'overdue' ? <Badge variant="danger">Zaległy</Badge> : null}
                          {urgency === 'urgent' ? <Badge variant="warning">Pilny</Badge> : null}
                          {urgency === 'upcoming' ? <Badge variant="accent">Nadchodzący</Badge> : null}
                        </div>
                        <div className="flex flex-col items-end justify-center gap-1 text-right sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                          <p className="text-lg font-semibold tracking-[-0.03em] text-zinc-950">{formatCurrency(getEventTotalCost(event))}</p>
                          {(event.attachmentCount ?? 0) > 0 ? (
                            <button
                              type="button"
                              aria-label={`Pokaż załączniki dla ${event.title}`}
                              data-testid={`service-attachments-trigger-${event.id}`}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation()
                                onEventClick(event)
                              }}
                            >
                              <Paperclip className="h-4 w-4" />
                              {event.attachmentCount ?? 0}
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-zinc-500">
                              <FileText className="h-4 w-4" />
                              0
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
