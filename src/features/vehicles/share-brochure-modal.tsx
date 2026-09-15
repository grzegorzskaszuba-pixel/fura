import QRCode from 'qrcode'
import { Copy, ExternalLink, QrCode, ShieldOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ActiveShareBrochure } from '@/data/repositories/share-brochure-repository'
import { ResponsiveModal } from '@/shared/components/responsive-modal'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { formatDate } from '@/shared/lib/format'

interface ShareBrochureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicleName: string
  shareUrl: string | null
  expiresAt: string | null
  activeLinks: ActiveShareBrochure[]
  isLoadingLinks: boolean
  isGenerating: boolean
  error: string | null
  onGenerate: () => Promise<void>
  onSelectLink: (link: ActiveShareBrochure) => void
  onRevoke: (id: string) => Promise<void>
}

export function ShareBrochureModal({
  open,
  onOpenChange,
  vehicleName,
  shareUrl,
  expiresAt,
  activeLinks,
  isLoadingLinks,
  isGenerating,
  error,
  onGenerate,
  onSelectLink,
  onRevoke,
}: ShareBrochureModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copyLabel, setCopyLabel] = useState('Kopiuj link')
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const isLimitReached = activeLinks.length >= 5

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

  async function handleCopyAny(url: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(url)
  }

  async function handleRevoke(id: string) {
    setRevokingId(id)

    try {
      await onRevoke(id)
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Udostepnij historie"
      description={`Publiczny podglad dla: ${vehicleName}`}
    >
      <div className="space-y-4 pb-2">
        <p className="text-sm text-zinc-600">
          Wygeneruj link QR do uproszczonej historii serwisowej. Link dziala przez 12h i prowadzi do odseparowanej strony tylko do odczytu.
        </p>

        <Button type="button" className="w-full" onClick={() => void onGenerate()} disabled={isGenerating || isLimitReached}>
          <QrCode className="h-4 w-4" />
          {isGenerating ? 'Generowanie...' : 'Generuj kod QR'}
        </Button>

        <p className="text-xs text-zinc-500">Aktywne linki dla auta: {activeLinks.length}/5</p>

        {isLimitReached ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Osiagnieto limit 5 aktywnych linkow. Uniewaznij jeden z linkow, aby wygenerowac nowy.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

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
              <Input readOnly value={shareUrl} aria-label="Link do publicznej broszury" />
              <p className="text-xs text-zinc-500">Wygasa: {expiresAt ? formatDate(expiresAt) : 'za 12h'}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800">Aktywne linki</p>
          {isLoadingLinks ? <p className="text-sm text-zinc-500">Ladowanie listy...</p> : null}
          {!isLoadingLinks && activeLinks.length === 0 ? <p className="text-sm text-zinc-500">Brak aktywnych linkow.</p> : null}

          {!isLoadingLinks
            ? activeLinks.map((link) => (
                <div key={link.id} className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
                  <p className="truncate text-xs text-zinc-500">ID: {link.id}</p>
                  <p className="text-xs text-zinc-500">Wygasa: {formatDate(link.expiresAt)}</p>
                  <Input readOnly value={link.url} aria-label={`Link ${link.id}`} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button type="button" variant="outline" onClick={() => onSelectLink(link)}>
                      <QrCode className="h-4 w-4" />
                      QR
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void handleCopyAny(link.url)}>
                      <Copy className="h-4 w-4" />
                      Kopiuj
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <a href={link.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Otworz
                      </a>
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void handleRevoke(link.id)} disabled={revokingId === link.id}>
                      <ShieldOff className="h-4 w-4" />
                      {revokingId === link.id ? '...' : 'Uniewaznij'}
                    </Button>
                  </div>
                </div>
              ))
            : null}
        </div>
      </div>
    </ResponsiveModal>
  )
}
