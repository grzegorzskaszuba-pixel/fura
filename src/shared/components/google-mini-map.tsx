import type { WorkshopLocation } from '@/shared/types/domain'

interface GoogleMiniMapProps {
  location: WorkshopLocation
  apiKey?: string
  className?: string
}

function buildEmbedUrl(location: WorkshopLocation, apiKey: string) {
  const query = location.placeId ? `place_id:${location.placeId}` : `${location.lat},${location.lng}`
  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&zoom=15`
}

export function GoogleMiniMap({ location, apiKey, className }: GoogleMiniMapProps) {
  if (!apiKey || apiKey.trim().length === 0) {
    return null
  }

  return (
    <div className={className}>
      <iframe
        title={`Mapa lokalizacji: ${location.label}`}
        src={buildEmbedUrl(location, apiKey)}
        className="h-44 w-full rounded-2xl border border-zinc-200"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}
