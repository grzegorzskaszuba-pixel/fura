import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, KeyRound, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { BrandLogo } from '@/shared/components/brand-logo'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

const passwordResetSchema = z
  .object({
    newPassword: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
    confirmPassword: z.string().min(6, 'Powtórz hasło'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Nowe hasła muszą być takie same',
    path: ['confirmPassword'],
  })

type PasswordResetValues = z.infer<typeof passwordResetSchema>

interface PasswordResetScreenProps {
  token: string
  onReset: (token: string, newPassword: string) => Promise<void>
  onBackToLogin: () => void
}

export function PasswordResetScreen({ token, onReset, onBackToLogin }: PasswordResetScreenProps) {
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function handleSubmit(values: PasswordResetValues) {
    setError(null)
    setIsSubmitting(true)

    try {
      await onReset(token, values.newPassword)
      setStatus('success')
      form.reset()
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Nie udało się ustawić nowego hasła.')
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4 py-6 sm:px-6">
      <Card className="w-full bg-white/92">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md space-y-7">
            <BrandLogo />
            {status === 'success' ? <CheckCircle2 className="h-12 w-12 text-emerald-600" /> : null}
            {status === 'error' ? <TriangleAlert className="h-12 w-12 text-amber-600" /> : null}
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{status === 'success' ? 'Hasło zostało zmienione' : 'Ustaw nowe hasło'}</h1>
              <p className="text-sm leading-6 text-zinc-600">
                {status === 'success' ? 'Możesz teraz zalogować się przy użyciu nowego hasła.' : 'Ustaw hasło, którego użyjesz przy następnym logowaniu.'}
              </p>
            </div>

            {status === 'form' || status === 'error' ? (
              <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                <div className="space-y-2">
                  <Label htmlFor="reset-new-password">Nowe hasło</Label>
                  <Input id="reset-new-password" type="password" autoComplete="new-password" disabled={isSubmitting} {...form.register('newPassword')} />
                  {form.formState.errors.newPassword ? <p className="text-sm text-red-600">{form.formState.errors.newPassword.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Powtórz nowe hasło</Label>
                  <Input id="reset-confirm-password" type="password" autoComplete="new-password" disabled={isSubmitting} {...form.register('confirmPassword')} />
                  {form.formState.errors.confirmPassword ? <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p> : null}
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {isSubmitting ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
                </Button>
              </form>
            ) : null}

            {status !== 'form' ? (
              <Button type="button" variant={status === 'success' ? 'primary' : 'outline'} size="lg" className="w-full" onClick={onBackToLogin}>
                Przejdź do logowania
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}