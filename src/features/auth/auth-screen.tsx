import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LoaderCircle, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/shared/components/ui/button'
import { BrandLogo } from '@/shared/components/brand-logo'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import type { LoginCredentials, RegisterCredentials } from '@/shared/types/domain'

const authSchema = z.object({
  username: z.string().trim().email('Podaj prawidłowy adres e-mail'),
  password: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
  displayName: z.string().trim().optional(),
})

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email('Podaj prawidłowy adres e-mail'),
})

type AuthValues = z.infer<typeof authSchema>
type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>

interface AuthScreenProps {
  onLogin: (credentials: LoginCredentials) => Promise<void>
  onRegister: (credentials: RegisterCredentials) => Promise<void>
  onRequestPasswordReset?: (email: string) => Promise<void>
  onResetPassword?: (credentials: LoginCredentials) => Promise<void>
  allowResetPassword?: boolean
  startupError?: string | null
}

export function AuthScreen({ onLogin, onRegister, onRequestPasswordReset, allowResetPassword = false, startupError = null }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false)
  const [passwordRecoverySent, setPasswordRecoverySent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordRecoverySubmitting, setIsPasswordRecoverySubmitting] = useState(false)

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: '',
      password: '',
      displayName: '',
    },
  })

  const passwordRecoveryForm = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: {
      email: '',
    },
  })

  async function handleSubmit(values: AuthValues) {
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await onLogin({ username: values.username, password: values.password })
      } else {
        if (!values.displayName?.trim() || values.displayName.trim().length < 2) {
          form.setError('displayName', { type: 'manual', message: 'Podaj nazwę użytkownika' })
          return
        }

        await onRegister({ username: values.username, password: values.password, displayName: values.displayName })
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nie udało się wykonać operacji')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordRecoverySubmit(values: PasswordResetRequestValues) {
    setPasswordRecoveryError(null)
    setIsPasswordRecoverySubmitting(true)

    try {
      if (!onRequestPasswordReset) {
        throw new Error('Odzyskiwanie hasła przez e-mail jest niedostępne w tym trybie.')
      }

      await onRequestPasswordReset(values.email)
      setPasswordRecoverySent(true)
      passwordRecoveryForm.reset(values)
    } catch (requestError) {
      setPasswordRecoveryError(requestError instanceof Error ? requestError.message : 'Nie udało się wysłać linku resetującego.')
    } finally {
      setIsPasswordRecoverySubmitting(false)
    }
  }

  function openLogin() {
    setShowPasswordRecovery(false)
    setPasswordRecoverySent(false)
    setPasswordRecoveryError(null)
    passwordRecoveryForm.reset()
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4 py-6 sm:px-6">
      <Card className="w-full bg-white/92">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md space-y-7">
            <div className="space-y-4">
              <BrandLogo />
              <p className="text-base font-medium leading-7 text-zinc-950 sm:text-lg">Prosty dziennik serwisowy dla każdego auta.</p>
              {startupError ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{startupError}</p> : null}
            </div>

              {!showPasswordRecovery ? (
              <div className="grid grid-cols-2 rounded-2xl bg-zinc-100 p-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  className={`rounded-[14px] px-4 py-3 text-sm font-medium transition ${mode === 'login' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                  onClick={() => setMode('login')}
                >
                  Logowanie
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  className={`rounded-[14px] px-4 py-3 text-sm font-medium transition ${mode === 'register' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                  onClick={() => setMode('register')}
                >
                  Rejestracja
                </button>
              </div>
              ) : null}

              {showPasswordRecovery ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Odzyskaj dostęp</h1>
                    <p className="text-sm leading-6 text-zinc-600">Podaj e-mail przypisany do konta. Wyślemy jednorazowy link do ustawienia nowego hasła.</p>
                  </div>
                  {passwordRecoverySent ? (
                    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                      <p>Jeśli konto jest przypisane do tego adresu, link resetujący został wysłany. Sprawdź skrzynkę pocztową.</p>
                      <p>Link jest ważny przez 30 minut.</p>
                    </div>
                  ) : (
                    <form className="space-y-4" onSubmit={passwordRecoveryForm.handleSubmit(handlePasswordRecoverySubmit)}>
                      <div className="space-y-2">
                        <Label htmlFor="recovery-email">E-mail użytkownika</Label>
                        <Input id="recovery-email" type="email" autoComplete="email" placeholder="np. kierowca@example.com" disabled={isPasswordRecoverySubmitting} {...passwordRecoveryForm.register('email')} />
                        {passwordRecoveryForm.formState.errors.email ? <p className="text-sm text-red-600">{passwordRecoveryForm.formState.errors.email.message}</p> : null}
                      </div>
                      {passwordRecoveryError ? <p className="text-sm text-red-600">{passwordRecoveryError}</p> : null}
                      <Button type="submit" size="lg" className="w-full" disabled={isPasswordRecoverySubmitting}>
                        {isPasswordRecoverySubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        {isPasswordRecoverySubmitting ? 'Wysyłanie...' : 'Wyślij link resetujący'}
                      </Button>
                    </form>
                  )}
                  <button type="button" className="w-full text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline" onClick={openLogin}>
                    Wróć do logowania
                  </button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                  <div className="space-y-2">
                    <Label htmlFor="username">E-mail użytkownika</Label>
                    <Input id="username" type="email" autoComplete="username" placeholder="np. kierowca@example.com" disabled={isSubmitting} {...form.register('username')} />
                    {form.formState.errors.username ? <p className="text-sm text-red-600">{form.formState.errors.username.message}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Hasło</Label>
                    <Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={isSubmitting} {...form.register('password')} />
                    {form.formState.errors.password ? <p className="text-sm text-red-600">{form.formState.errors.password.message}</p> : null}
                  </div>

                  {mode === 'register' ? (
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Nazwa użytkownika</Label>
                      <Input id="displayName" autoComplete="name" placeholder="np. Jan Kowalski" disabled={isSubmitting} {...form.register('displayName')} />
                      {form.formState.errors.displayName ? <p className="text-sm text-red-600">{form.formState.errors.displayName.message}</p> : null}
                    </div>
                  ) : null}

                  {error ? <p className="text-sm text-red-600">{error}</p> : null}

                  <div className="flex flex-col gap-3 pt-2">
                    <Button type="submit" size="lg" disabled={isSubmitting}>
                      {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      {isSubmitting ? (mode === 'login' ? 'Trwa logowanie...' : 'Tworzenie profilu...') : mode === 'login' ? 'Zaloguj' : 'Utwórz profil'}
                    </Button>
                    {mode === 'login' && allowResetPassword ? (
                      <button type="button" className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline" onClick={() => setShowPasswordRecovery(true)}>
                        Nie pamiętam hasła
                      </button>
                    ) : null}
                  </div>
                </form>
              )}

          </div>
        </CardContent>
      </Card>
    </main>
  )
}
