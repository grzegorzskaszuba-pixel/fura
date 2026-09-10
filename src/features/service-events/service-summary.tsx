import { CalendarDays, Gauge, ReceiptText, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Card, CardContent } from '@/shared/components/ui/card'
import { formatCurrency, formatDate, formatMileage, getEventTotalCost } from '@/shared/lib/format'
import type { ServiceEvent, Vehicle } from '@/shared/types/domain'

interface ServiceSummaryProps {
  vehicle: Vehicle
  completedEvents: ServiceEvent[]
  plannedEvents: ServiceEvent[]
}

function getDaysUntilText(eventDate?: string) {
  if (!eventDate) {
    return 'Brak planu'
  }

  const now = new Date()
  const target = new Date(eventDate)

  if (Number.isNaN(target.getTime())) {
    return 'Brak planu'
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTargetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffMs = startOfTargetDay.getTime() - startOfToday.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} dni po terminie`
  }

  if (diffDays === 0) {
    return 'Dzisiaj'
  }

  return `Za ${diffDays} ${diffDays === 1 ? 'dzień' : 'dni'}`
}

function getSummaryStats(vehicle: Vehicle, completedEvents: ServiceEvent[], plannedEvents: ServiceEvent[], showAltView: boolean) {
  const totalSpend = completedEvents.reduce((sum, event) => sum + getEventTotalCost(event), 0)
  const lastService = completedEvents[0]
  const nextService = plannedEvents[0]
  const nextServiceDate = formatDate(nextService?.eventDate)
  const nextServiceInDays = getDaysUntilText(nextService?.eventDate)
  const nextServiceMileageHint =
    nextService?.mileage && vehicle.currentMileage ? `Za ${formatMileage(nextService.mileage - vehicle.currentMileage)}` : null
  const showLastExpense = showAltView && Boolean(lastService)

  return [
    {
      label: 'Przebieg',
      value: formatMileage(vehicle.currentMileage),
      hint: 'Aktualny',
      icon: Gauge,
    },
    {
      label: 'Następny serwis',
      value: showAltView ? nextServiceInDays : nextServiceDate,
      hint: nextServiceMileageHint ?? (showAltView ? nextServiceDate : nextServiceInDays),
      icon: CalendarDays,
    },
    {
      label: 'Ostatni serwis',
      value: formatDate(lastService?.eventDate),
      hint: formatMileage(lastService?.mileage),
      icon: Wrench,
    },
    {
      label: 'Wydatki',
      value: showLastExpense ? formatCurrency(getEventTotalCost(lastService as ServiceEvent)) : formatCurrency(totalSpend),
      hint: showLastExpense ? 'Ostatni' : 'Wszystkie',
      icon: ReceiptText,
    },
  ]
}

export function ServiceSummary({ vehicle, completedEvents, plannedEvents }: ServiceSummaryProps) {
  const [showAltView, setShowAltView] = useState(false)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setShowAltView((prev) => !prev)
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const items = getSummaryStats(vehicle, completedEvents, plannedEvents, showAltView)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.label} className="bg-white/94">
            <CardContent className="flex h-full flex-col gap-3 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <Icon className="h-4 w-4 text-zinc-500" />
                {item.label}
              </div>
              <div className="space-y-1">
                <div className="text-[1.45rem] font-semibold leading-none tracking-[-0.05em] text-zinc-950 sm:text-[1.95rem]">{item.value}</div>
                <div className="text-xs text-zinc-500 sm:text-sm">{item.hint}</div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
