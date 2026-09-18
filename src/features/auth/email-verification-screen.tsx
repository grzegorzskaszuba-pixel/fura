import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { notifyEmailVerificationCompleted } from '@/features/auth/email-verification-events'
import { BrandLogo } from '@/shared/components/brand-logo'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'

interface EmailVerificationScreenProps {
  token: string
  onVerify: (token: string) => Promise<void>
  onBackToLogin: () => void
}

export function EmailVerificationScreen({ token, onVerify, onBackToLogin }: EmailVerificationScreenProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const verificationStarted = useRef(false)

  useEffect(() => {
    if (verificationStarted.current) {
      return
    }

    verificationStarted.current = true

    void onVerify(token)
      .then(() => {
        notifyEmailVerificationCompleted()
        setStatus('success')
      })
      .catch((verificationError) => {
        setError(verificationError instanceof Error ? verificationError.message : 'Nie udało się potwierdzić adresu e-mail.')
        setStatus('error')
      })
  }, [onVerify, token])

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4 py-6 sm:px-6">
      <Card className="w-full bg-white/92">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md space-y-7">
            <BrandLogo />
            {status === 'loading' ? (
              <div className="flex items-center gap-3 text-zinc-600">
                <LoaderCircle className="h-6 w-6 animate-spin" />
                <p>Potwierdzanie adresu e-mail...</p>
              </div>
            ) : null}
            {status === 'success' ? (
              <div className="space-y-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Adres e-mail potwierdzony</h1>
                  <p className="text-sm leading-6 text-zinc-600">Konto jest aktywne. Możesz się teraz zalogować.</p>
                </div>
              </div>
            ) : null}
            {status === 'error' ? (
              <div className="space-y-4">
                <TriangleAlert className="h-12 w-12 text-amber-600" />
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Nie udało się potwierdzić adresu</h1>
                  <p className="text-sm leading-6 text-red-700">{error}</p>
                </div>
              </div>
            ) : null}
            {status !== 'loading' ? (
              <Button type="button" size="lg" onClick={onBackToLogin}>
                Przejdź do logowania
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}