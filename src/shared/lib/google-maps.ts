export interface GooglePrediction {
  description: string
  place_id: string
}

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const PLACES_DETAILS_BASE_URL = 'https://places.googleapis.com/v1/places'

interface PlacesAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string
      text?: {
        text?: string
      }
    }
  }>
  error?: {
    message?: string
  }
}

interface PlacesDetailsResponse {
  id?: string
  displayName?: {
    text?: string
  }
  formattedAddress?: string
  location?: {
    latitude?: number
    longitude?: number
  }
  error?: {
    message?: string
  }
}

function getApiKey(apiKey: string) {
  const normalized = apiKey.trim()

  if (normalized.length === 0) {
    throw new Error('Brak VITE_GOOGLE_MAPS_API_KEY')
  }

  return normalized
}

function readJsonError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const value = payload as { error?: { message?: string } }
  return value.error?.message ?? null
}

export async function fetchGooglePlacePredictions(apiKey: string, input: string): Promise<GooglePrediction[]> {
  const key = getApiKey(apiKey)
  const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['pl'],
      languageCode: 'pl',
    }),
  })

  const payload = (await response.json()) as PlacesAutocompleteResponse

  if (!response.ok) {
    throw new Error(readJsonError(payload) ?? 'Błąd pobierania podpowiedzi Google Places')
  }

  const suggestions = payload.suggestions ?? []

  return suggestions
    .map((entry) => {
      const placePrediction = entry.placePrediction
      const placeId = placePrediction?.placeId
      const description = placePrediction?.text?.text

      if (!placeId || !description) {
        return null
      }

      return {
        place_id: placeId,
        description,
      }
    })
    .filter((entry): entry is GooglePrediction => entry !== null)
}

export interface GooglePlaceLocation {
  placeId: string
  label: string
  address?: string
  lat: number
  lng: number
}

export async function fetchGooglePlaceDetails(apiKey: string, placeId: string): Promise<GooglePlaceLocation | null> {
  const key = getApiKey(apiKey)
  const response = await fetch(`${PLACES_DETAILS_BASE_URL}/${encodeURIComponent(placeId)}?languageCode=pl`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
    },
  })

  const payload = (await response.json()) as PlacesDetailsResponse

  if (!response.ok) {
    throw new Error(readJsonError(payload) ?? 'Błąd pobierania szczegółów lokalizacji')
  }

  if (!payload.id || payload.location?.latitude === undefined || payload.location.longitude === undefined) {
    return null
  }

  return {
    placeId: payload.id,
    label: payload.displayName?.text ?? payload.formattedAddress ?? '',
    address: payload.formattedAddress,
    lat: payload.location.latitude,
    lng: payload.location.longitude,
  }
}
