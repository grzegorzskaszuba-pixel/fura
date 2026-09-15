import QRCode from 'qrcode'
import { Copy, ExternalLink, QrCode, ShieldOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ResponsiveModal } from '@/shared/components/responsive-modal'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { formatDate } from '@/shared/lib/format'

interface ShareBrochureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicleName: string
  shareId: string | null
  shareUrl: string | null
  expiresAt: string | null
  isLoading: boolean
  isGenerating: boolean
  error: string | null
  onGenerate: () => Promise<void>
  onRevoke: () => Promise<void>
}

export function ShareBrochureModal({
  open,
  onOpenChange,
  vehicleName,
  shareId,
  shareUrl,
  expiresAt,
  isLoading,
  isGenerating,
  error,
  onGenerate,
  onRevoke,
}: ShareBrochureModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copyLabel, setCopyLabel] = useState('Kopiuj link')
  const [isRevoking, setIsRevoking] = useState(false)

  useEffect(() => {
    if (!open) {
      setCopyLabel('Kopiuj link')
    }
  }, [open])

  useEffect(() => {
    let active = true

    if (!shareUrl) {
      setQrDataUrl(null)
      return () => {
        active = false
      }
    }

    void (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(shareUrl, {
          width: 300,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#111111',
            light: '#FFFFFF',
          },
        })

        if (active) {
          setQrDataUrl(dataUrl)
        }
      } catch {
        if (active) {
          setQrDataUrl(null)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [shareUrl])

  async function handleCopy() {
    if (!shareUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(shareUrl)
    setCopyLabel('Skopiowano')
    window.setTimeout(() => setCopyLabel('Kopiuj link'), 1800)
  }

  async function handleRevoke() {
    setIsRevoking(true)

    try {
      await onRevoke()
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Podziel się dokumentacją"
      description={`Publiczny podglad dla: ${vehicleName}`}
    >
      <div className="space-y-4 pb-2">
        <p className="text-sm text-zinc-600">
          Wygeneruj link QR do uproszczonej historii serwisowej twojego samochodu. Link jest aktywny tylko przez 6h i prowadzi do odizolowanej strony, która nie jest powiązana z Twoim profilem.
        </p>
        <p className="text-xs text-zinc-500">Po 6 godzinach link wygasa i nie odnawia się automatycznie. Aby udostępnić ponownie, wygeneruj nowy link.</p>

        <Button type="button" className="w-full" onClick={() => void onGenerate()} disabled={isGenerating}>
          <QrCode className="h-4 w-4" />
          {isGenerating ? 'Generowanie...' : shareUrl ? 'Pobierz aktywny link' : 'Generuj nowy link QR'}
        </Button>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading ? <p className="text-sm text-zinc-500">Sprawdzam aktywny link...</p> : null}

        {shareUrl ? (
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
            <div className="flex justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Kod QR do publicznej historii serwisowej"
                  className="h-[220px] w-[220px] rounded-2xl border border-zinc-200 bg-white p-2"
                />
              ) : (
                <div className="grid h-[220px] w-[220px] place-items-center rounded-2xl border border-zinc-200 bg-white text-sm text-zinc-500">Ladowanie QR...</div>
              )}
            </div>

            <div className="space-y-2">
              {shareId ? <p className="truncate text-xs text-zinc-500">ID: {shareId}</p> : null}
              <Input readOnly value={shareUrl} aria-label="Link do publicznej broszury" />
              <p className="text-xs text-zinc-500">Wygasa: {expiresAt ? formatDate(expiresAt) : 'za 6h'}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button type="button" variant="outline" onClick={() => void handleCopy()}>
                <Copy className="h-4 w-4" />
                {copyLabel}
              </Button>
              <Button type="button" variant="outline" asChild>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Otworz
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleRevoke()} disabled={isRevoking}>
                <ShieldOff className="h-4 w-4" />
                {isRevoking ? '...' : 'Uniewaznij'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </ResponsiveModal>
  )
}
