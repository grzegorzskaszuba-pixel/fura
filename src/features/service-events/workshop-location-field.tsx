import { useEffect, useMemo, useRef, useState } from 'react'

import { GoogleMiniMap } from '@/shared/components/google-mini-map'
import { appConfig } from '@/shared/config/app-config'
import { Input } from '@/shared/components/ui/input'
import { fetchGooglePlaceDetails, fetchGooglePlacePredictions, loadGoogleMapsPlaces } from '@/shared/lib/google-maps'
import type { WorkshopLocation } from '@/shared/types/domain'

interface WorkshopLocationFieldProps {
  workshopName: string
  workshopLocation?: WorkshopLocation
  onWorkshopNameChange: (value: string) => void
  onWorkshopLocationChange: (value: WorkshopLocation | undefined) => void
}

export function WorkshopLocationField({
  workshopName,
  workshopLocation,
  onWorkshopNameChange,
  onWorkshopLocationChange,
}: WorkshopLocationFieldProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [predictions, setPredictions] = useState<Array<{ place_id: string; description: string }>>([])
  const [loading, setLoading] = useState(false)
  const [mapsReady, setMapsReady] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const apiKey = appConfig.googleMapsApiKey

  const shouldShowSuggestions = focused && predictions.length > 0

  useEffect(() => {
    let cancelled = false

    async function prepareMaps() {
      if (!apiKey) {
        return
      }

      try {
        await loadGoogleMapsPlaces(apiKey)

        if (!cancelled) {
          setMapsReady(true)
          setMapsError(null)
        }
      } catch {
        if (!cancelled) {
          setMapsError('Nie udało się załadować Google Maps')
        }
      }
    }

    void prepareMaps()

    return () => {
      cancelled = true
    }
  }, [apiKey])

  useEffect(() => {
    if (!apiKey || !focused || !mapsReady || workshopName.trim().length < 3) {
      setPredictions([])
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setLoading(true)

      try {
        const nextPredictions = await fetchGooglePlacePredictions(apiKey, workshopName.trim())

        if (!cancelled) {
          setPredictions(nextPredictions)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [apiKey, focused, mapsReady, workshopName])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setFocused(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [])

  const externalMapLink = useMemo(() => {
    if (!workshopLocation) {
      return null
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${workshopLocation.lat},${workshopLocation.lng}`)}`
  }, [workshopLocation])

  async function handleSelectSuggestion(placeId: string, description: string) {
    if (!apiKey) {
      onWorkshopNameChange(description)
      onWorkshopLocationChange(undefined)
      setPredictions([])
      return
    }

    const details = await fetchGooglePlaceDetails(apiKey, placeId)

    if (!details) {
      onWorkshopNameChange(description)
      onWorkshopLocationChange(undefined)
      setPredictions([])
      return
    }

    onWorkshopNameChange(details.label || description)
    onWorkshopLocationChange({
      placeId: details.placeId,
      label: details.label || description,
      address: details.address,
      lat: details.lat,
      lng: details.lng,
    })
    setPredictions([])
    setFocused(false)
  }

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <Input
        id="service-workshop"
        placeholder="Nazwa warsztatu lub adres"
        value={workshopName}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const value = event.target.value
          onWorkshopNameChange(value)

          if (!workshopLocation || value.trim() !== workshopLocation.label.trim()) {
            onWorkshopLocationChange(undefined)
          }
        }}
      />

      {shouldShowSuggestions ? (
        <div className="max-h-56 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg">
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={() => void handleSelectSuggestion(prediction.place_id, prediction.description)}
            >
              {prediction.description}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <p className="text-xs text-zinc-500">Szukam lokalizacji...</p> : null}
      {mapsError ? <p className="text-xs text-amber-700">{mapsError}</p> : null}
      {!apiKey ? <p className="text-xs text-zinc-500">Dodaj VITE_GOOGLE_MAPS_API_KEY, aby włączyć podpowiedzi warsztatu.</p> : null}

      {workshopLocation ? (
        <div className="space-y-2 rounded-3xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-medium text-zinc-800">{workshopLocation.address ?? workshopLocation.label}</p>
          <GoogleMiniMap location={workshopLocation} apiKey={apiKey} />
          {externalMapLink ? (
            <a href={externalMapLink} target="_blank" rel="noreferrer" className="text-xs font-medium text-orange-700 hover:text-orange-800">
              Otwórz w Google Maps
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
