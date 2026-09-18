import { Check, LoaderCircle, MailCheck, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { BrandLogo } from '@/shared/components/brand-logo'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'

interface EmailVerificationPendingProps {
  email: string
  onResend: () => Promise<void>
  onBackToLogin: () => void
}

export function EmailVerificationPending({ email, onResend, onBackToLogin }: EmailVerificationPendingProps) {
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    setIsResending(true)
    setMessage(null)
    setError(null)

    try {
      await onResend()
      setMessage('Nowy link został wysłany. Sprawdź skrzynkę pocztową.')
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Nie udało się wysłać linku ponownie.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4 py-6 sm:px-6">
      <Card className="w-full bg-white/92">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md space-y-7">
            <BrandLogo />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <MailCheck className="h-7 w-7" />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Sprawdź swoją skrzynkę</h1>
              <p className="text-sm leading-6 text-zinc-600">
                Wysłaliśmy link potwierdzający na adres <strong className="break-all text-zinc-950">{email}</strong>. Link jest ważny przez 24 godziny.
              </p>
            </div>

            {message ? (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <Check className="h-4 w-4 shrink-0" />
                {message}
              </p>
            ) : null}
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

            <div className="flex flex-col gap-3">
              <Button type="button" size="lg" disabled={isResending} onClick={() => void handleResend()}>
                {isResending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isResending ? 'Wysyłanie...' : 'Wyślij ponownie link'}
              </Button>
              <button type="button" className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline" onClick={onBackToLogin}>
                Wróć do logowania
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}