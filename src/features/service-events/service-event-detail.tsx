import { ChevronLeft, ChevronRight, FileImage, FileSpreadsheet, FileText, ImageIcon, Paperclip, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ResponsiveModal } from '@/shared/components/responsive-modal'
import { GoogleMiniMap } from '@/shared/components/google-mini-map'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { getAttachmentExtension, isImageAttachment, normalizeServiceAttachments } from '@/shared/lib/attachments'
import { serviceCategoryLabels } from '@/shared/constants/service-categories'
import { cn } from '@/shared/lib/utils'
import { formatCurrency, formatDate, formatMileage, getEventTotalCost, getPlannedEventUrgency } from '@/shared/lib/format'
import type { ServiceAttachment, ServiceEvent, Vehicle } from '@/shared/types/domain'
import { appConfig } from '@/shared/config/app-config'

interface ServiceEventDetailProps {
  event: ServiceEvent | null
  vehicle: Vehicle
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: (eventId: string) => Promise<void>
  onMarkCompleted: (event: ServiceEvent) => Promise<void>
}

export function ServiceEventDetail({ event, vehicle, open, onOpenChange, onEdit, onDelete, onMarkCompleted }: ServiceEventDetailProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const galleryViewportRef = useRef<HTMLDivElement | null>(null)
  const attachments = useMemo(() => normalizeServiceAttachments(event ?? {}), [event])
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const urgency = event?.status === 'planned' ? getPlannedEventUrgency(event, vehicle.currentMileage) : null
  const activeAttachment = attachments[activeAttachmentIndex]

  useEffect(() => {
    if (!open) {
      return
    }

    setActiveAttachmentIndex(0)
    setViewerOpen(false)
  }, [event?.id, open])

  useEffect(() => {
    if (!open || attachments.length <= 1) {
      return
    }

    scrollGalleryToIndex(activeAttachmentIndex, 'auto')
  }, [activeAttachmentIndex, attachments.length, open])

  function scrollGalleryToIndex(index: number, behavior: ScrollBehavior) {
    const viewport = galleryViewportRef.current

    if (!viewport) {
      return
    }

    const left = viewport.clientWidth * index

    if (typeof viewport.scrollTo !== 'function') {
      viewport.scrollLeft = left
      return
    }

    viewport.scrollTo({
      left,
      behavior,
    })
  }

  function selectAttachment(index: number, behavior: ScrollBehavior = 'smooth') {
    const nextIndex = Math.max(0, Math.min(index, attachments.length - 1))

    setActiveAttachmentIndex(nextIndex)
    scrollGalleryToIndex(nextIndex, behavior)
  }

  function handleGalleryScroll() {
    const viewport = galleryViewportRef.current

    if (!viewport) {
      return
    }

    const nextIndex = Math.round(viewport.scrollLeft / Math.max(viewport.clientWidth, 1))

    if (nextIndex !== activeAttachmentIndex) {
      setActiveAttachmentIndex(Math.max(0, Math.min(nextIndex, attachments.length - 1)))
    }
  }

  if (!event) {
    return null
  }

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title={event.title}
        description={serviceCategoryLabels[event.category]}
      >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{event.status === 'completed' ? 'Wykonany' : 'Planowany'}</Badge>
          {urgency === 'overdue' ? <Badge variant="danger">Zaległy</Badge> : null}
          {urgency === 'urgent' ? <Badge variant="warning">Pilny</Badge> : null}
          {urgency === 'upcoming' ? <Badge variant="accent">Nadchodzący</Badge> : null}
        </div>

        <div className="grid gap-4 rounded-[28px] bg-zinc-50 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Data</p>
            <p className="mt-1 text-base font-semibold text-zinc-950">{formatDate(event.eventDate)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Przebieg</p>
            <p className="mt-1 text-base font-semibold text-zinc-950">{formatMileage(event.mileage)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Koszt</p>
            <p className="mt-1 text-base font-semibold text-zinc-950">{formatCurrency(getEventTotalCost(event))}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Załączniki</p>
            <p className="mt-1 text-base font-semibold text-zinc-950">{event.attachmentCount ?? 0}</p>
          </div>
        </div>

        <div className="space-y-4 text-sm leading-7 text-zinc-600">
          {event.description ? <p>{event.description}</p> : null}
          {event.workshopName ? (
            <p>
              <span className="font-medium text-zinc-950">Warsztat:</span> {event.workshopName}
            </p>
          ) : null}
          {event.workshopLocation ? (
            <div className="space-y-2 rounded-[24px] border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Lokalizacja</p>
              <p className="text-sm text-zinc-700">{event.workshopLocation.address ?? event.workshopLocation.label}</p>
              <GoogleMiniMap location={event.workshopLocation} apiKey={appConfig.googleMapsApiKey} />
            </div>
          ) : null}
        </div>

        {attachments.length > 0 ? (
          <div className="space-y-3 rounded-[28px] border border-zinc-200 bg-white p-3 sm:p-4" data-testid="attachment-gallery">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Załączniki</p>
                <p className="truncate text-sm font-medium text-zinc-700">
                  {activeAttachment?.name} {attachments.length > 1 ? `(${activeAttachmentIndex + 1}/${attachments.length})` : ''}
                </p>
              </div>
              {!isMobile && attachments.length > 1 ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label="Poprzedni załącznik" onClick={() => selectAttachment(activeAttachmentIndex - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" aria-label="Następny załącznik" onClick={() => selectAttachment(activeAttachmentIndex + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <div
                ref={galleryViewportRef}
                className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                onScroll={handleGalleryScroll}
              >
                {attachments.map((attachment, index) => (
                  <div key={attachment.id} className="min-w-full shrink-0 snap-center" data-attachment-slide={index}>
                    <button
                      type="button"
                      data-testid={`attachment-slide-${index}`}
                      className="flex h-[260px] w-full items-center justify-center overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-50 text-left transition hover:border-zinc-300 sm:h-[320px]"
                      onClick={() => setViewerOpen(true)}
                    >
                      <AttachmentPreview attachment={attachment} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {attachments.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {attachments.map((attachment, index) => (
                  <button
                    key={attachment.id}
                    type="button"
                    data-testid={`attachment-thumbnail-${index}`}
                    aria-pressed={index === activeAttachmentIndex}
                    className={cn(
                      'h-20 w-20 shrink-0 overflow-hidden rounded-2xl border bg-zinc-50 transition',
                      index === activeAttachmentIndex ? 'border-zinc-950 ring-2 ring-zinc-950/10' : 'border-zinc-200 hover:border-zinc-300',
                    )}
                    onClick={() => selectAttachment(index)}
                  >
                    <AttachmentPreview attachment={attachment} compact />
                  </button>
                ))}
              </div>
            ) : null}

            <p className="text-xs text-zinc-500">Przesuń załączniki w bok na telefonie albo użyj strzałek na większym ekranie.</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={onEdit}>
              Edytuj
            </Button>
            {event.status === 'planned' ? (
              <Button variant="secondary" onClick={() => onMarkCompleted(event)}>
                Oznacz jako wykonany
              </Button>
            ) : null}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Usuń wpis</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Usunąć wpis?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ta operacja usuwa wpis tylko z lokalnej bazy danych dla bieżącego profilu.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="ghost">
                    Anuluj
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction
                  asChild
                  onClick={async () => {
                    await onDelete(event.id)
                    onOpenChange(false)
                  }}
                >
                  <Button type="button" variant="destructive">
                    Usuń
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      </ResponsiveModal>

      {viewerOpen && activeAttachment ? (
        <div className="fixed inset-0 z-[70] bg-black/80 p-4 sm:p-6" data-testid="attachment-lightbox" onClick={() => setViewerOpen(false)}>
          <div className="relative mx-auto flex h-full max-w-5xl flex-col rounded-[32px] bg-zinc-950/95 p-4 text-white shadow-2xl sm:p-6" onClick={(viewerEvent) => viewerEvent.stopPropagation()}>
            <button
              type="button"
              aria-label="Zamknij podgląd załącznika"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              onClick={() => setViewerOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="pr-12">
              <p className="truncate text-sm font-medium text-white">{activeAttachment.name}</p>
              <p className="text-xs text-white/60">{attachments.length > 1 ? `${activeAttachmentIndex + 1} z ${attachments.length}` : 'Podgląd załącznika'}</p>
            </div>
            <div className="mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-black/20">
              <AttachmentPreview attachment={activeAttachment} enlarged />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              {attachments.length > 1 ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => selectAttachment(activeAttachmentIndex - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Poprzedni
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => selectAttachment(activeAttachmentIndex + 1)}>
                    Następny
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : <span />}
              <Button type="button" variant="ghost" onClick={() => setViewerOpen(false)}>
                Zamknij
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function AttachmentPreview({ attachment, compact = false, enlarged = false }: { attachment: ServiceAttachment; compact?: boolean; enlarged?: boolean }) {
  if (attachment.previewUrl && isImageAttachment(attachment)) {
    return (
      <img
        src={attachment.previewUrl}
        alt={attachment.name}
        className={cn('h-full w-full bg-zinc-100 object-contain', compact ? 'object-cover' : '', enlarged ? 'max-h-full' : '')}
      />
    )
  }

  const Icon = getAttachmentIcon(attachment)
  const extension = getAttachmentExtension(attachment.name)?.toUpperCase() ?? 'PLIK'

  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-100 via-white to-zinc-200 text-zinc-700', compact ? 'p-3' : 'p-6')}>
      <div className={cn('flex items-center justify-center rounded-full bg-white/80 text-zinc-700 shadow-sm', compact ? 'h-10 w-10' : 'h-16 w-16')}>
        <Icon className={compact ? 'h-5 w-5' : 'h-8 w-8'} />
      </div>
      <p className={cn('mt-3 max-w-full truncate font-semibold text-zinc-900', compact ? 'text-xs' : enlarged ? 'text-lg' : 'text-sm')}>{attachment.name}</p>
      {!compact ? <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{extension}</p> : null}
    </div>
  )
}

function getAttachmentIcon(attachment: ServiceAttachment) {
  const extension = getAttachmentExtension(attachment.name)

  if (isImageAttachment(attachment)) {
    return attachment.previewUrl ? ImageIcon : FileImage
  }

  if (extension === 'xls' || extension === 'xlsx' || extension === 'csv') {
    return FileSpreadsheet
  }

  if (extension === 'pdf' || extension === 'doc' || extension === 'docx' || extension === 'rtf' || extension === 'odt') {
    return FileText
  }

  return Paperclip
}
