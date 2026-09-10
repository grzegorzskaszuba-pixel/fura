import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/shared/lib/utils'
import type { Vehicle } from '@/shared/types/domain'

interface VehicleCarouselProps {
  vehicles: Vehicle[]
  activeVehicleId?: string
  onVehicleSelect: (vehicleId: string) => void
}

const VIN_COPY_HOLD_MS = 280
const SWIPE_THRESHOLD_PX = 48
const MAX_DRAG_OFFSET_PX = 88

export function VehicleCarousel({ vehicles, activeVehicleId, onVehicleSelect }: VehicleCarouselProps) {
  const pointerIdRef = useRef<number | null>(null)
  const dragStartXRef = useRef<number | null>(null)
  const dragStartYRef = useRef<number | null>(null)
  const dragDeltaXRef = useRef(0)
  const dragFrameRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const previousActiveIndex = useRef(0)
  const vinHoldTimeoutRef = useRef<number | null>(null)
  const vinHoldStartAtRef = useRef<number | null>(null)
  const vinProgressFrameRef = useRef<number | null>(null)
  const vinPromptTimeoutRef = useRef<number | null>(null)
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('left')
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [vinCopied, setVinCopied] = useState(false)
  const [vinHoldProgress, setVinHoldProgress] = useState(0)
  const activeIndex = Math.max(
    vehicles.findIndex((vehicle) => vehicle.id === activeVehicleId),
    0,
  )
  const activeVehicle = vehicles[activeIndex]
  const previousVehicle = vehicles[(activeIndex - 1 + vehicles.length) % vehicles.length]
  const nextVehicle = vehicles[(activeIndex + 1) % vehicles.length]

  useEffect(() => {
    if (vehicles.length <= 1) {
      previousActiveIndex.current = activeIndex
      return
    }

    if (previousActiveIndex.current === activeIndex) {
      return
    }

    setAnimationDirection(resolveDirection(previousActiveIndex.current, activeIndex, vehicles.length))
    previousActiveIndex.current = activeIndex
  }, [activeIndex, vehicles.length])

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current)
      }

      if (vinHoldTimeoutRef.current !== null) {
        window.clearTimeout(vinHoldTimeoutRef.current)
      }

      if (vinProgressFrameRef.current !== null) {
        window.cancelAnimationFrame(vinProgressFrameRef.current)
      }

      if (vinPromptTimeoutRef.current !== null) {
        window.clearTimeout(vinPromptTimeoutRef.current)
      }
    }
  }, [])

  if (vehicles.length === 0 || !activeVehicle) {
    return null
  }

  function move(step: number) {
    const nextIndex = (activeIndex + step + vehicles.length) % vehicles.length
    onVehicleSelect(vehicles[nextIndex].id)
  }

  function scheduleDragOffsetUpdate(deltaX: number) {
    dragDeltaXRef.current = Math.max(-MAX_DRAG_OFFSET_PX, Math.min(MAX_DRAG_OFFSET_PX, deltaX))

    if (dragFrameRef.current !== null) {
      return
    }

    dragFrameRef.current = window.requestAnimationFrame(() => {
      setDragOffset(dragDeltaXRef.current)
      dragFrameRef.current = null
    })
  }

  function resetDrag() {
    pointerIdRef.current = null
    dragStartXRef.current = null
    dragStartYRef.current = null
    dragDeltaXRef.current = 0
    isDraggingRef.current = false
    setIsDragging(false)
    setDragOffset(0)
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && target.closest('button, a, input, textarea, select, label') !== null
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) {
      return
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    pointerIdRef.current = event.pointerId
    dragStartXRef.current = event.clientX
    dragStartYRef.current = event.clientY
    dragDeltaXRef.current = 0
    isDraggingRef.current = false
    setIsDragging(false)

    if ('setPointerCapture' in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId || dragStartXRef.current === null) {
      return
    }

    const deltaX = event.clientX - dragStartXRef.current
    const startY = dragStartYRef.current ?? event.clientY
    const deltaY = event.clientY - startY

    if (!isDraggingRef.current && Math.abs(deltaX) <= Math.abs(deltaY)) {
      return
    }

    if (!isDraggingRef.current && Math.abs(deltaX) < 6) {
      return
    }

    isDraggingRef.current = true

    if (!isDragging) {
      setIsDragging(true)
    }

    scheduleDragOffsetUpdate(deltaX)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId || dragStartXRef.current === null) {
      return
    }

    if ('releasePointerCapture' in event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const delta = event.clientX - dragStartXRef.current

    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      move(delta > 0 ? -1 : 1)
    }

    resetDrag()
  }

  function handlePointerCancel() {
    resetDrag()
  }

  function clearVinHoldTimer() {
    if (vinHoldTimeoutRef.current !== null) {
      window.clearTimeout(vinHoldTimeoutRef.current)
      vinHoldTimeoutRef.current = null
    }
  }

  function stopVinProgress(reset = true) {
    if (vinProgressFrameRef.current !== null) {
      window.cancelAnimationFrame(vinProgressFrameRef.current)
      vinProgressFrameRef.current = null
    }

    vinHoldStartAtRef.current = null

    if (reset) {
      setVinHoldProgress(0)
    }
  }

  function startVinHoldCountdown() {
    clearVinHoldTimer()
    stopVinProgress()

    const startedAt = performance.now()
    vinHoldStartAtRef.current = startedAt
    setVinHoldProgress(0)

    const tick = () => {
      if (vinHoldStartAtRef.current === null) {
        return
      }

      const elapsed = performance.now() - vinHoldStartAtRef.current
      const progress = Math.min(1, elapsed / VIN_COPY_HOLD_MS)
      setVinHoldProgress(progress)

      if (progress < 1) {
        vinProgressFrameRef.current = window.requestAnimationFrame(tick)
      } else {
        vinProgressFrameRef.current = null
      }
    }

    vinProgressFrameRef.current = window.requestAnimationFrame(tick)
    vinHoldTimeoutRef.current = window.setTimeout(() => {
      setVinHoldProgress(1)
      void copyVinToClipboard()
      clearVinHoldTimer()
    }, VIN_COPY_HOLD_MS)
  }

  async function copyVinToClipboard() {
    if (!activeVehicle.vin || !navigator.clipboard) {
      if (!activeVehicle.vin) {
        return
      }

      if (!copyVinWithSelection(activeVehicle.vin)) {
        return
      }

      showVinCopiedPrompt()
      return
    }

    try {
      await navigator.clipboard.writeText(activeVehicle.vin)
    } catch {
      if (!copyVinWithSelection(activeVehicle.vin)) {
        return
      }
    }

    showVinCopiedPrompt()
  }

  function showVinCopiedPrompt() {
    setVinCopied(true)

    if (vinPromptTimeoutRef.current !== null) {
      window.clearTimeout(vinPromptTimeoutRef.current)
    }

    vinPromptTimeoutRef.current = window.setTimeout(() => {
      setVinCopied(false)
      vinPromptTimeoutRef.current = null
    }, 1400)
  }

  function copyVinWithSelection(vin: string) {
    const textarea = document.createElement('textarea')
    textarea.value = vin
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  }

  function handleVinPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'touch') {
      return
    }

    startVinHoldCountdown()
  }

  function handleVinPointerUp() {
    clearVinHoldTimer()
    stopVinProgress()
  }

  function handleVinTouchStart(event: React.TouchEvent<HTMLButtonElement>) {
    event.stopPropagation()
    startVinHoldCountdown()
  }

  function handleVinTouchEnd(event: React.TouchEvent<HTMLButtonElement>) {
    event.stopPropagation()
    clearVinHoldTimer()
    stopVinProgress()
  }

  function handleVinTouchCancel(event: React.TouchEvent<HTMLButtonElement>) {
    event.stopPropagation()
    clearVinHoldTimer()
    stopVinProgress()
  }

  function renderMainVehicle(vehicle: Vehicle) {
    return (
      <div
        key={`${vehicle.id}-${animationDirection}`}
        className={cn(
          'pointer-events-none absolute inset-0 z-10 flex items-center justify-center',
          isDragging ? 'transition-none' : 'transition-transform duration-200 ease-out',
        )}
        style={{ transform: dragOffset === 0 ? undefined : `translate3d(${dragOffset}px, 0, 0)` }}
      >
        <div
          className={cn(
            'vehicle-carousel-slide flex aspect-square w-[76%] items-center justify-center overflow-hidden rounded-full border border-zinc-200/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(244,244,242,0.92))] shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:w-[78%]',
            animationDirection === 'left' ? 'vehicle-carousel-enter-right' : 'vehicle-carousel-enter-left',
          )}
        >
          <img
            src={vehicle.imageUrl}
            alt={vehicle.name}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    )
  }

  function renderPreviewVehicle(vehicle: Vehicle, side: 'left' | 'right') {
    return (
      <button
        key={`${side}-${vehicle.id}`}
        type="button"
        aria-label={`Pokaż auto ${vehicle.name}`}
        className={cn(
          'absolute top-1/2 z-0 aspect-square w-[31%] -translate-y-1/2 overflow-hidden rounded-full border border-zinc-200/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(244,244,242,0.9))] opacity-90 blur-[0.4px] hover:scale-[1.03] hover:opacity-90 sm:w-[40%] sm:opacity-70 sm:blur-[1.5px]',
          isDragging ? 'transition-none' : 'transition duration-200 ease-out',
          side === 'left' ? 'left-0 -translate-x-[6%] sm:-translate-x-[8%]' : 'right-0 translate-x-[6%] sm:translate-x-[8%]',
        )}
        style={{ transform: `translate3d(${(side === 'left' ? -1 : 1) * dragOffset * 0.18}px, -50%, 0)` }}
        onClick={() => onVehicleSelect(vehicle.id)}
      >
        <img src={vehicle.imageUrl} alt={vehicle.name} className="h-full w-full object-cover" />
        <span className="pointer-events-none absolute inset-0 bg-white/18" />
      </button>
    )
  }

  return (
    <section className="space-y-4">
      <div
        data-testid="vehicle-carousel-gesture-area"
        className="relative select-none px-4 py-4 touch-pan-y sm:px-5 sm:py-5"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="mx-auto w-full max-w-[280px] pt-8 sm:max-w-[460px] lg:max-w-[560px]">
          <div className="relative h-[220px] sm:h-[360px] lg:h-[420px]">
            {vehicles.length > 2 ? renderPreviewVehicle(previousVehicle, 'left') : null}
            {vehicles.length > 1 ? renderPreviewVehicle(nextVehicle, 'right') : null}

            {renderMainVehicle(activeVehicle)}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[260px] px-2 pb-[3px] pt-5 text-center sm:max-w-[420px] sm:px-0 lg:max-w-[520px]">
          <div className="space-y-0.5">
            <h2 data-testid="active-vehicle-name" className="text-[2rem] font-semibold tracking-[-0.05em] text-zinc-950">
              {activeVehicle.name}
            </h2>
            {activeVehicle.vin ? (
              <div className="relative flex justify-center pb-0.5">
                <button
                  type="button"
                  className="relative inline-flex select-none items-center justify-center overflow-hidden rounded-full border border-zinc-300/70 bg-white/45 px-3 py-1 text-center text-[11px] font-medium tracking-[0.08em] text-zinc-700 shadow-[0_4px_14px_rgba(15,23,42,0.05)] backdrop-blur-sm transition-colors hover:border-zinc-400/70 hover:bg-white/55 [-webkit-touch-callout:none]"
                  onPointerDown={handleVinPointerDown}
                  onPointerUp={handleVinPointerUp}
                  onPointerLeave={handleVinPointerUp}
                  onPointerCancel={handleVinPointerUp}
                  onTouchStart={handleVinTouchStart}
                  onTouchEnd={handleVinTouchEnd}
                  onTouchCancel={handleVinTouchCancel}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span className="relative z-10">{activeVehicle.vin}</span>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-zinc-300/40">
                    <span
                      className="absolute inset-0 origin-left bg-zinc-700/55"
                      style={{ transform: `scaleX(${vinHoldProgress})` }}
                    />
                  </span>
                </button>
                <span
                  className={cn(
                    'pointer-events-none absolute left-1/2 top-full -translate-x-1/2 rounded-full border border-zinc-200 bg-white/92 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition duration-200',
                    vinCopied ? 'translate-y-1 opacity-100' : 'translate-y-0 opacity-0',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Check className="h-3 w-3 text-emerald-600" />
                    Skopiowano
                  </span>
                </span>
              </div>
            ) : null}
            {activeVehicle.registrationNumber ? (
              <div className="flex justify-center">
                <span className="inline-flex min-h-10 items-stretch overflow-hidden rounded-[0.7rem] border border-zinc-300 bg-white shadow-[0_10px_22px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/5">
                  <span className="flex w-8 shrink-0 items-center justify-center bg-[#0b4ea2] px-1 text-white">
                    <span className="text-[9px] font-semibold leading-none tracking-[0.2em]">PL</span>
                  </span>
                  <span className="flex items-center justify-center border-l border-zinc-300 px-4 py-1 text-[0.95rem] font-semibold tracking-[0.22em] text-zinc-900 sm:px-5 sm:text-base">
                    {activeVehicle.registrationNumber}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function resolveDirection(previousIndex: number, nextIndex: number, total: number): 'left' | 'right' {
  if (total <= 1) {
    return 'left'
  }

  if (previousIndex === total - 1 && nextIndex === 0) {
    return 'left'
  }

  if (previousIndex === 0 && nextIndex === total - 1) {
    return 'right'
  }

  return nextIndex > previousIndex ? 'left' : 'right'
}
