let googleMapsLoader: Promise<void> | null = null
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-js-sdk'

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: { input: string; componentRestrictions?: { country: string } },
              callback: (predictions: GooglePrediction[] | null, status: string) => void,
            ) => void
          }
          PlacesService: new (container: HTMLDivElement) => {
            getDetails: (
              request: { placeId: string; fields: string[] },
              callback: (result: GooglePlaceDetails | null, status: string) => void,
            ) => void
          }
          PlacesServiceStatus: {
            OK: string
          }
        }
      }
    }
  }
}

export interface GooglePrediction {
  description: string
  place_id: string
}

export interface GooglePlaceDetails {
  place_id?: string
  name?: string
  formatted_address?: string
  geometry?: {
    location?: {
      lat: () => number
      lng: () => number
    }
  }
}

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export async function loadGoogleMapsPlaces(apiKey: string) {
  const normalizedApiKey = apiKey.trim()

  if (!canUseDom() || normalizedApiKey.length === 0) {
    return
  }

  if (window.google?.maps?.places) {
    return
  }

  if (!googleMapsLoader) {
    googleMapsLoader = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true })
        existingScript.addEventListener('error', () => reject(new Error('Nie udało się załadować Google Maps')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.id = GOOGLE_MAPS_SCRIPT_ID
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(normalizedApiKey)}&libraries=places&language=pl`
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Nie udało się załadować Google Maps'))

      document.head.appendChild(script)
    })
  }

  await googleMapsLoader
}

export async function fetchGooglePlacePredictions(apiKey: string, input: string): Promise<GooglePrediction[]> {
  await loadGoogleMapsPlaces(apiKey)

  const mapsApi = window.google?.maps?.places

  if (!mapsApi) {
    return []
  }

  return new Promise((resolve) => {
    const service = new mapsApi.AutocompleteService()

    service.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'pl' },
      },
      (predictions, status) => {
        if (status !== mapsApi.PlacesServiceStatus.OK || !predictions) {
          resolve([])
          return
        }

        resolve(predictions.map((prediction) => ({
          description: prediction.description,
          place_id: prediction.place_id,
        })))
      },
    )
  })
}

export interface GooglePlaceLocation {
  placeId: string
  label: string
  address?: string
  lat: number
  lng: number
}

export async function fetchGooglePlaceDetails(apiKey: string, placeId: string): Promise<GooglePlaceLocation | null> {
  await loadGoogleMapsPlaces(apiKey)

  const mapsApi = window.google?.maps?.places

  if (!mapsApi) {
    return null
  }

  return new Promise((resolve) => {
    const service = new mapsApi.PlacesService(document.createElement('div'))

    service.getDetails(
      {
        placeId,
        fields: ['place_id', 'name', 'formatted_address', 'geometry'],
      },
      (result, status) => {
        if (status !== mapsApi.PlacesServiceStatus.OK || !result?.geometry?.location || !result.place_id) {
          resolve(null)
          return
        }

        resolve({
          placeId: result.place_id,
          label: result.name ?? result.formatted_address ?? '',
          address: result.formatted_address,
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
        })
      },
    )
  })
}
