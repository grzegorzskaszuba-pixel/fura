import { CarFront, ChevronDown, Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { appStateRepository } from '@/data/repositories/app-state-repository'
import { profileRepository } from '@/data/repositories/profile-repository'
import { serviceEventRepository } from '@/data/repositories/service-event-repository'
import { vehicleRepository } from '@/data/repositories/vehicle-repository'
import { authService } from '@/features/auth/auth-service-factory'
import { AuthScreen } from '@/features/auth/auth-screen'
import { ProfileMenu } from '@/features/profile/profile-menu'
import { ProfileSettingsModal } from '@/features/profile/profile-settings-modal'
import { ServiceEventDetail } from '@/features/service-events/service-event-detail'
import { ServiceEventForm } from '@/features/service-events/service-event-form'
import { ServiceEventList } from '@/features/service-events/service-event-list'
import { ServiceSummary } from '@/features/service-events/service-summary'
import { VehicleCarousel } from '@/features/vehicles/vehicle-carousel'
import { VehicleForm } from '@/features/vehicles/vehicle-form'
import { EmptyState } from '@/shared/components/empty-state'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { getDefaultVehicleImage } from '@/shared/constants/vehicle-images'
import { cn, getTodayIsoDate } from '@/shared/lib/utils'
import { sortEventsAsc, sortEventsDesc } from '@/shared/lib/format'
import type { ServiceEvent, ServiceEventFormValues, ServiceTab, UserProfile, Vehicle, VehicleFormValues } from '@/shared/types/domain'

const LOGO_PHASE_INTERVAL_MS = 10000
const logoPhases = ['pill-dark', 'icon', 'pill-dark', 'pill-light'] as const
type LogoPhase = (typeof logoPhases)[number]

export default function App() {
  const [serviceTab, setServiceTab] = useState<ServiceTab>('history')
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null)
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false)
  const [serviceFormOpen, setServiceFormOpen] = useState(false)
  const [serviceFormStatus, setServiceFormStatus] = useState<'completed' | 'planned'>('completed')
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false)
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [persistedActiveVehicleId, setPersistedActiveVehicleId] = useState<string | null>(null)
  const [serviceEvents, setServiceEvents] = useState<ServiceEvent[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [appError, setAppError] = useState<string | null>(null)
  const [logoPhaseIndex, setLogoPhaseIndex] = useState(0)
  const [deleteVehicleDialogOpen, setDeleteVehicleDialogOpen] = useState(false)

  const activeVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? vehicles[0] ?? null, [activeVehicleId, vehicles])
  const editingVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === editingVehicleId) ?? null, [editingVehicleId, vehicles])
  const editingEvent = useMemo(() => serviceEvents.find((event) => event.id === editingEventId) ?? null, [editingEventId, serviceEvents])
  const detailEvent = useMemo(() => serviceEvents.find((event) => event.id === detailEventId) ?? null, [detailEventId, serviceEvents])
  const logoPhase: LogoPhase = logoPhases[logoPhaseIndex]

  async function loadProfileWorkspace(profileId: string) {
    const [profile, savedVehicleId, profileVehicles] = await Promise.all([
      profileRepository.getById(profileId),
      appStateRepository.getCurrentVehicleId(profileId),
      vehicleRepository.listByProfile(profileId),
    ])

    setCurrentProfile(profile)
    setPersistedActiveVehicleId(savedVehicleId)
    setVehicles(profileVehicles)
  }

  async function reloadVehicles(profileId: string) {
    const profileVehicles = await vehicleRepository.listByProfile(profileId)
    setVehicles(profileVehicles)
  }

  useEffect(() => {
    let mounted = true

    void (async () => {
      setIsBootstrapping(true)
      setAppError(null)

      try {
        const profileId = await authService.getCurrentProfileId()

        if (!mounted) {
          return
        }

        setCurrentProfileId(profileId)

        if (!profileId) {
          setCurrentProfile(null)
          setVehicles([])
          setServiceEvents([])
          setPersistedActiveVehicleId(null)
          return
        }

        await loadProfileWorkspace(profileId)
      } catch (error) {
        if (!mounted) {
          return
        }

        setAppError(error instanceof Error ? error.message : 'Nie udało się połączyć z serwerem API. Uruchom npm run dev i odśwież stronę.')
      } finally {
        if (mounted) {
          setIsBootstrapping(false)
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const phaseInterval = window.setInterval(() => {
      setLogoPhaseIndex((prev) => (prev + 1) % logoPhases.length)
    }, LOGO_PHASE_INTERVAL_MS)

    return () => {
      window.clearInterval(phaseInterval)
    }
  }, [])

  useEffect(() => {
    if (!currentProfileId) {
      setActiveVehicleId(null)
      return
    }

    if (persistedActiveVehicleId && vehicles.some((vehicle) => vehicle.id === persistedActiveVehicleId)) {
      setActiveVehicleId(persistedActiveVehicleId)
      return
    }

    setActiveVehicleId(vehicles[0]?.id ?? null)
  }, [currentProfileId, persistedActiveVehicleId, vehicles])

  useEffect(() => {
    if (!currentProfileId || vehicles.length === 0) {
      return
    }

    if (!persistedActiveVehicleId || !activeVehicle) {
      void appStateRepository.setCurrentVehicleId(currentProfileId, vehicles[0].id)
    }
  }, [activeVehicle, currentProfileId, persistedActiveVehicleId, vehicles])

  useEffect(() => {
    if (!currentProfileId || !activeVehicle?.id) {
      setServiceEvents([])
      return
    }

    void (async () => {
      try {
        const events = await serviceEventRepository.listByVehicle(currentProfileId, activeVehicle.id)
        setServiceEvents(events)
      } catch (error) {
        setServiceEvents([])
        setAppError(error instanceof Error ? error.message : 'Nie udało się pobrać historii serwisowej')
      }
    })()
  }, [activeVehicle?.id, currentProfileId])

  async function handleVehicleSelect(vehicleId: string) {
    if (!currentProfileId) {
      return
    }

    setActiveVehicleId(vehicleId)
    await appStateRepository.setCurrentVehicleId(currentProfileId, vehicleId)
  }

  useEffect(() => {
    if (detailEvent && detailEvent.status === 'planned') {
      setServiceTab('plan')
    }
  }, [detailEvent])

  if (!currentProfile) {
    if (isBootstrapping) {
      return (
        <main className="mx-auto flex min-h-svh w-full max-w-6xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm text-zinc-500">Łączenie z serwerem...</p>
        </main>
      )
    }

    return (
      <AuthScreen
        startupError={appError}
        onLogin={async (credentials) => {
          setAppError(null)
          const profile = await authService.login(credentials)
          setCurrentProfileId(profile.id)
          await loadProfileWorkspace(profile.id)
        }}
        onRegister={async (credentials) => {
          setAppError(null)
          const profile = await authService.register(credentials)
          setCurrentProfileId(profile.id)
          await loadProfileWorkspace(profile.id)
        }}
        onResetPassword={(credentials) => authService.resetPassword(credentials)}
        allowResetPassword={false}
      />
    )
  }

  const completedEvents = sortEventsDesc(serviceEvents.filter((event) => event.status === 'completed'))
  const plannedEvents = sortEventsAsc(serviceEvents.filter((event) => event.status === 'planned'))
  const visibleEvents = serviceTab === 'history' ? completedEvents : plannedEvents

  async function handleVehicleSave(values: VehicleFormValues) {
    if (!currentProfileId) {
      return
    }

    const normalizedValues = {
      ...values,
      imageUrl: values.imageUrl || getDefaultVehicleImage(values.bodyType),
    }

    if (editingVehicle) {
      await vehicleRepository.update(editingVehicle.id, normalizedValues)
      await reloadVehicles(currentProfileId)
      setEditingVehicleId(null)
      return
    }

    const createdVehicle = await vehicleRepository.create(currentProfileId, normalizedValues)
    await appStateRepository.setCurrentVehicleId(currentProfileId, createdVehicle.id)
    setPersistedActiveVehicleId(createdVehicle.id)
    await reloadVehicles(currentProfileId)
  }

  async function handleDeleteVehicle(vehicleId: string) {
    if (!currentProfileId) {
      return
    }

    await vehicleRepository.remove(vehicleId)
    const profileVehicles = await vehicleRepository.listByProfile(currentProfileId)
    setVehicles(profileVehicles)

    const nextVehicleId = profileVehicles[0]?.id ?? null
    setPersistedActiveVehicleId(nextVehicleId)
    setActiveVehicleId(nextVehicleId)
    setServiceEvents([])
    setEditingVehicleId(null)
    setDetailEventId(null)

    await appStateRepository.setCurrentVehicleId(currentProfileId, nextVehicleId)
  }

  async function handleServiceEventSave(values: ServiceEventFormValues) {
    if (!currentProfileId || !activeVehicle) {
      return
    }

    if (editingEvent) {
      await serviceEventRepository.update(editingEvent.id, values)
      await maybeUpdateVehicleMileage(activeVehicle.id, values.mileage)
      const events = await serviceEventRepository.listByVehicle(currentProfileId, activeVehicle.id)
      setServiceEvents(events)
      setEditingEventId(null)
      return
    }

    await serviceEventRepository.create(currentProfileId, activeVehicle.id, values)
    await maybeUpdateVehicleMileage(activeVehicle.id, values.mileage)
    const events = await serviceEventRepository.listByVehicle(currentProfileId, activeVehicle.id)
    setServiceEvents(events)
  }

  async function maybeUpdateVehicleMileage(vehicleId: string, mileage?: number) {
    if (!mileage) {
      return
    }

    const vehicle = vehicles.find((entry) => entry.id === vehicleId)

    if (!vehicle || (vehicle.currentMileage ?? 0) >= mileage) {
      return
    }

    await vehicleRepository.update(vehicleId, {
      name: vehicle.name,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      bodyType: vehicle.bodyType,
      fuelType: vehicle.fuelType,
      transmission: vehicle.transmission,
      engine: vehicle.engine,
      power: vehicle.power,
      color: vehicle.color,
      vin: vehicle.vin,
      registrationNumber: vehicle.registrationNumber,
      currentMileage: mileage,
      imageUrl: vehicle.imageUrl,
      notes: vehicle.notes,
    })

    if (currentProfileId) {
      await reloadVehicles(currentProfileId)
    }
  }

  async function handleMarkCompleted(event: ServiceEvent) {
    await serviceEventRepository.update(event.id, {
      status: 'completed',
      category: event.category,
      title: event.title,
      eventDate: event.eventDate || getTodayIsoDate(),
      mileage: event.mileage,
      description: event.description,
      workshopName: event.workshopName,
      partsCost: event.partsCost,
      laborCost: event.laborCost,
      otherCost: event.otherCost,
      attachmentCount: event.attachmentCount,
      attachmentNames: event.attachmentNames,
      attachments: event.attachments,
      isRecurring: event.isRecurring,
      recurrenceType: event.recurrenceType,
      recurrenceIntervalValue: event.recurrenceIntervalValue,
      recurrenceIntervalUnit: event.recurrenceIntervalUnit,
      recurrenceMileageInterval: event.recurrenceMileageInterval,
    })
    await maybeUpdateVehicleMileage(event.vehicleId, event.mileage)
    setDetailEventId(null)
    setServiceTab('history')
  }

  async function handleDeleteEvent(eventId: string) {
    await serviceEventRepository.remove(eventId)
    if (currentProfileId && activeVehicle?.id) {
      const events = await serviceEventRepository.listByVehicle(currentProfileId, activeVehicle.id)
      setServiceEvents(events)
    }
    setEditingEventId(null)
    setDetailEventId(null)
  }

  async function handleLogout() {
    setAppError(null)

    // Optimistic local logout so UI switches to auth screen immediately.
    setCurrentProfileId(null)
    setCurrentProfile(null)
    setVehicles([])
    setServiceEvents([])
    setPersistedActiveVehicleId(null)
    setActiveVehicleId(null)
    setEditingVehicleId(null)
    setEditingEventId(null)
    setDetailEventId(null)
    setProfileSettingsOpen(false)

    try {
      await authService.logout()
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Wylogowano lokalnie, ale nie udało się zamknąć wszystkich sesji na serwerze.')
    }
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="space-y-4 sm:space-y-5">
        {appError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {appError}
          </div>
        ) : null}

        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ProfileMenu
              currentProfile={currentProfile}
              onOpenProfile={() => setProfileSettingsOpen(true)}
              onLogout={() => void handleLogout()}
            />
            {activeVehicle ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Menu auta"
                    className="inline-flex items-center justify-center rounded-full bg-white p-2 shadow-sm ring-1 ring-zinc-200/80 transition hover:ring-zinc-300 sm:gap-3 sm:px-3 sm:py-2"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-white">
                      <CarFront className="h-5 w-5" />
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className="block text-sm font-semibold text-zinc-950">Auto</span>
                      <span className="block max-w-28 truncate text-xs text-zinc-500">{activeVehicle.name}</span>
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-zinc-500 sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Aktywny pojazd</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditingVehicleId(activeVehicle.id)
                      setVehicleFormOpen(true)
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edytuj wybrane
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditingVehicleId(null)
                      setVehicleFormOpen(true)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj nowe
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => setDeleteVehicleDialogOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Usuń wybrane
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          <div className="relative inline-flex h-14 w-[220px] items-center justify-end pr-4 sm:w-[260px]" aria-label="Branding FURA">
            <span
              aria-hidden="true"
              className={cn(
                'absolute right-0 top-1/2 inline-flex h-14 -translate-y-1/2 items-center justify-center overflow-hidden shadow-sm ring-1 transition-all duration-700 ease-in-out',
                logoPhase === 'pill-dark' ? 'w-[168px] rounded-full bg-zinc-950 px-4 text-white ring-zinc-950/90 opacity-100' : '',
                logoPhase === 'pill-light' ? 'w-[168px] rounded-full bg-white px-4 text-zinc-950 ring-zinc-200/80 opacity-100' : '',
                logoPhase === 'icon' ? 'w-14 rounded-full bg-zinc-950 text-white ring-zinc-950/90 opacity-100' : '',
                logoPhase !== 'pill-dark' && logoPhase !== 'pill-light' && logoPhase !== 'icon' ? 'opacity-0 scale-95' : '',
              )}
            >
              <span
                className={cn(
                  'absolute inset-0 grid -translate-x-[0.05em] place-items-center text-[52px] font-semibold leading-none tracking-[-0.08em] transition-opacity duration-500',
                  logoPhase === 'pill-dark' || logoPhase === 'pill-light' ? 'opacity-100' : 'opacity-0',
                )}
              >
                FURA
              </span>
              <span
                className={cn(
                  'absolute inset-0 grid -translate-x-[0.05em] place-items-center text-[52px] font-semibold leading-none tracking-[-0.08em] transition-opacity duration-500',
                  logoPhase === 'icon' ? 'opacity-100' : 'opacity-0',
                )}
              >
                F
              </span>
            </span>
          </div>
        </header>

        {vehicles.length === 0 ? (
          <div className="space-y-4 pt-8">
            <EmptyState
              icon={<CarFront className="h-6 w-6" />}
              title="Brak aut w profilu"
              description="Dodaj pierwsze auto, aby rozpocząć prowadzenie historii serwisowej."
            />
            <Button size="lg" className="w-full" onClick={() => setVehicleFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Dodaj auto
            </Button>
          </div>
        ) : activeVehicle ? (
          <>
            <VehicleCarousel
              vehicles={vehicles}
              activeVehicleId={activeVehicle.id}
              onVehicleSelect={(vehicleId) => void handleVehicleSelect(vehicleId)}
            />

            <ServiceSummary vehicle={activeVehicle} completedEvents={completedEvents} plannedEvents={plannedEvents} />

            <ServiceEventList
              tab={serviceTab}
              vehicle={activeVehicle}
              events={visibleEvents}
              onTabChange={setServiceTab}
              onEventClick={(event) => setDetailEventId(event.id)}
            />
          </>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            data-testid="add-service-button"
            onClick={() => {
              setEditingEventId(null)
              setServiceFormStatus('completed')
              setServiceFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">Dodaj</span>
            <span className="hidden sm:inline">Dodaj serwis</span>
          </Button>
          <Button
            size="lg"
            data-testid="plan-service-button"
            onClick={() => {
              setEditingEventId(null)
              setServiceFormStatus('planned')
              setServiceFormOpen(true)
            }}
          >
            <Wrench className="h-4 w-4" />
            <span className="sm:hidden">Zaplanuj</span>
            <span className="hidden sm:inline">Zaplanuj serwis</span>
          </Button>
        </div>
      </div>

      <VehicleForm
        open={vehicleFormOpen}
        onOpenChange={(open) => {
          setVehicleFormOpen(open)
          if (!open) {
            setEditingVehicleId(null)
          }
        }}
        initialValues={editingVehicle}
        onSubmit={handleVehicleSave}
      />

      <ServiceEventForm
        open={serviceFormOpen}
        onOpenChange={(open) => {
          setServiceFormOpen(open)
          if (!open) {
            setEditingEventId(null)
          }
        }}
        defaultStatus={serviceFormStatus}
        initialValues={editingEvent}
        onSubmit={handleServiceEventSave}
      />

      {activeVehicle ? (
        <ServiceEventDetail
          event={detailEvent}
          vehicle={activeVehicle}
          open={Boolean(detailEvent)}
          onOpenChange={(open) => {
            if (!open) {
              setDetailEventId(null)
            }
          }}
          onEdit={() => {
            if (!detailEvent) {
              return
            }

            setEditingEventId(detailEvent.id)
            setServiceFormStatus(detailEvent.status === 'planned' ? 'planned' : 'completed')
            setServiceFormOpen(true)
            setDetailEventId(null)
          }}
          onDelete={handleDeleteEvent}
          onMarkCompleted={handleMarkCompleted}
        />
      ) : null}

      <ProfileSettingsModal
        open={profileSettingsOpen}
        onOpenChange={setProfileSettingsOpen}
        currentProfile={currentProfile}
        onUpdateProfile={async (values) => {
          await profileRepository.upsert({
            ...currentProfile,
            displayName: values.displayName,
            updatedAt: new Date().toISOString(),
          })
        }}
        onChangePassword={async (values) => {
          await authService.changePassword(currentProfile.id, values)
        }}
      />

      <AlertDialog open={deleteVehicleDialogOpen} onOpenChange={setDeleteVehicleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wybrane auto?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeVehicle?.name
                ? `Czy na pewno chcesz usunąć auto "${activeVehicle.name}"? Tej operacji nie da się cofnąć. Razem z autem stracisz całą historię serwisową.`
                : 'Czy na pewno chcesz usunąć wybrane auto? Tej operacji nie da się cofnąć. Razem z autem stracisz całą historię serwisową.'}
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
                if (!activeVehicle) {
                  return
                }

                await handleDeleteVehicle(activeVehicle.id)
                setDeleteVehicleDialogOpen(false)
              }}
            >
              <Button type="button" variant="destructive">
                Usuń auto
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        type="button"
        className="sr-only"
        onClick={() => {
          setEditingVehicleId(activeVehicle?.id ?? null)
          setVehicleFormOpen(true)
        }}
      >
        Edytuj auto
      </button>
    </main>
  )
}
