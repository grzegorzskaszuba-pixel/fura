import { CalendarDays, Gauge, ReceiptText, Wrench } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { ResponsiveModal } from '@/shared/components/responsive-modal'
import { Card, CardContent } from '@/shared/components/ui/card'
import { serviceCategoryLabels } from '@/shared/constants/service-categories'
import { formatCurrency, formatDate, formatMileage, getEventTotalCost } from '@/shared/lib/format'
import type { ServiceEvent, Vehicle } from '@/shared/types/domain'

interface ServiceSummaryProps {
  vehicle: Vehicle
  completedEvents: ServiceEvent[]
  plannedEvents: ServiceEvent[]
  onNextServiceClick?: () => void
}

interface SummaryItem {
  key: 'mileage' | 'next-service' | 'last-service' | 'expenses'
  label: string
  value: ReactNode
  hint: ReactNode
  icon: typeof Gauge
}

const DONUT_COLORS = ['#f97316', '#fb923c', '#fdba74', '#f59e0b', '#facc15', '#a16207', '#ea580c', '#ffedd5'] as const

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
    return 'Po terminie'
  }

  if (diffDays === 0) {
    return 'Dzisiaj'
  }

  return `Za ${diffDays} ${diffDays === 1 ? 'dzień' : 'dni'}`
}

function getDaysUntilValue(eventDate?: string): ReactNode {
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
    return <span className="text-primary">Po terminie</span>
  }

  if (diffDays === 0) {
    return 'Dzisiaj'
  }

  return (
    <>
      Za <span className="text-primary">{diffDays}</span> {diffDays === 1 ? 'dzień' : 'dni'}
    </>
  )
}

function getSummaryStats(vehicle: Vehicle, completedEvents: ServiceEvent[], plannedEvents: ServiceEvent[], showAltView: boolean): SummaryItem[] {
  const totalSpend = completedEvents.reduce((sum, event) => sum + getEventTotalCost(event), 0)
  const lastService = completedEvents[0]
  const nextService = plannedEvents[0]
  const nextServiceDate = formatDate(nextService?.eventDate)
  const nextServiceInDaysText = getDaysUntilText(nextService?.eventDate)
  const nextServiceInDaysValue = getDaysUntilValue(nextService?.eventDate)
  const nextServiceMileageHint =
    nextService?.mileage && vehicle.currentMileage ? `Za ${formatMileage(nextService.mileage - vehicle.currentMileage)}` : null
  const showLastExpense = showAltView && Boolean(lastService)
  const lastServiceSpend = lastService ? getEventTotalCost(lastService) : 0

  return [
    {
      key: 'mileage',
      label: 'Przebieg',
      value: formatMileage(vehicle.currentMileage),
      hint: 'Aktualny',
      icon: Gauge,
    },
    {
      key: 'next-service',
      label: 'Następny serwis',
      value: showAltView ? nextServiceInDaysValue : nextServiceDate,
      hint: nextServiceMileageHint ?? (showAltView ? nextServiceDate : nextServiceInDaysText),
      icon: CalendarDays,
    },
    {
      key: 'last-service',
      label: 'Ostatni serwis',
      value: formatDate(lastService?.eventDate),
      hint: formatMileage(lastService?.mileage),
      icon: Wrench,
    },
    {
      key: 'expenses',
      label: 'Wydatki',
      value: showLastExpense ? formatCurrency(lastServiceSpend) : formatCurrency(totalSpend),
      hint: showLastExpense ? 'Ostatni' : 'Wszystkie',
      icon: ReceiptText,
    },
  ]
}

export function ServiceSummary({ vehicle, completedEvents, plannedEvents, onNextServiceClick }: ServiceSummaryProps) {
  const [showAltView, setShowAltView] = useState(false)
  const [isFadedIn, setIsFadedIn] = useState(true)
  const [expensesReportOpen, setExpensesReportOpen] = useState(false)
  const nextPlannedService = plannedEvents[0] ?? null

  useEffect(() => {
    const fadeOutMs = 260
    let timeoutId: number | null = null

    const intervalId = window.setInterval(() => {
      setIsFadedIn(false)

      timeoutId = window.setTimeout(() => {
        setShowAltView((prev) => !prev)
        setIsFadedIn(true)
      }, fadeOutMs)
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  const items = getSummaryStats(vehicle, completedEvents, plannedEvents, showAltView)
  const categorySummary = useMemo(() => {
    const categoryTotals = new Map<string, number>()

    for (const event of completedEvents) {
      const current = categoryTotals.get(event.category) ?? 0
      categoryTotals.set(event.category, current + getEventTotalCost(event))
    }

    const entries = Array.from(categoryTotals.entries())
      .map(([category, value], index) => ({
        category,
        label: serviceCategoryLabels[category as keyof typeof serviceCategoryLabels],
        value,
        color: DONUT_COLORS[index % DONUT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)

    const total = entries.reduce((sum, entry) => sum + entry.value, 0)

    return {
      entries,
      total,
    }
  }, [completedEvents])

  const donutStyle = useMemo(() => {
    if (categorySummary.total <= 0 || categorySummary.entries.length === 0) {
      return { background: 'conic-gradient(#f4f4f5 0% 100%)' }
    }

    let start = 0
    const segments = categorySummary.entries.map((entry) => {
      const share = (entry.value / categorySummary.total) * 100
      const end = Math.min(100, start + share)
      const segment = `${entry.color} ${start}% ${end}%`
      start = end
      return segment
    })

    return {
      background: `conic-gradient(${segments.join(', ')})`,
    }
  }, [categorySummary])

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon
          const isAnimated = item.key === 'next-service' || item.key === 'expenses'
          const isNextServiceClickable = item.key === 'next-service' && Boolean(nextPlannedService) && Boolean(onNextServiceClick)
          const isExpensesClickable = item.key === 'expenses'
          const isClickable = isNextServiceClickable || isExpensesClickable

          return (
            <Card key={item.label} className="bg-white/94">
              <CardContent className="h-full px-0 py-0">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (isNextServiceClickable) {
                      onNextServiceClick?.()
                      return
                    }

                    if (isExpensesClickable) {
                      setExpensesReportOpen(true)
                    }
                  }}
                  className={`flex h-full w-full flex-col gap-3 rounded-2xl px-4 py-4 text-left sm:px-5 ${
                    isClickable ? 'cursor-pointer transition hover:bg-zinc-50/70' : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                    <Icon className="h-4 w-4 text-zinc-500" />
                    {item.label}
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`text-[1.45rem] font-semibold leading-none tracking-[-0.05em] text-zinc-950 sm:text-[1.95rem] ${
                        isAnimated ? 'transition-opacity duration-300' : ''
                      } ${isAnimated && !isFadedIn ? 'opacity-0' : 'opacity-100'}`}
                    >
                      {item.value}
                    </div>
                    <div
                      className={`text-xs text-zinc-500 sm:text-sm ${
                        isAnimated ? 'transition-opacity duration-300' : ''
                      } ${isAnimated && !isFadedIn ? 'opacity-0' : 'opacity-100'}`}
                    >
                      {item.hint}
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ResponsiveModal
        open={expensesReportOpen}
        onOpenChange={setExpensesReportOpen}
        title="Raport wydatków"
        description="Podsumowanie kosztów wykonanych serwisów"
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 p-4">
            <div className="relative h-44 w-44 rounded-full" style={donutStyle}>
              <div className="absolute inset-[22%] grid place-items-center rounded-full bg-white text-center">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-400">Suma</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">{formatCurrency(categorySummary.total)}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-500">Udział wydatków według kategorii</p>
          </div>

          <div className="space-y-2 rounded-[28px] border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Podział na kategorie</p>
            {categorySummary.entries.length === 0 ? (
              <p className="text-sm text-zinc-500">Brak odnotowanych kosztów wykonanych serwisów.</p>
            ) : (
              <div className="space-y-2">
                {categorySummary.entries.map((entry) => {
                  const percent = categorySummary.total > 0 ? (entry.value / categorySummary.total) * 100 : 0

                  return (
                    <div key={entry.category} className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{entry.label}</span>
                      <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-zinc-950">{formatCurrency(entry.value)} ({percent.toFixed(0)}%)</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </ResponsiveModal>
    </>
  )
}
