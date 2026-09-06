import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import type { LoginCredentials, RegisterCredentials } from '@/shared/types/domain'

const authSchema = z.object({
  username: z.string().trim().min(2, 'Podaj nazwę użytkownika'),
  password: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
  displayName: z.string().trim().optional(),
})

type AuthValues = z.infer<typeof authSchema>

interface AuthScreenProps {
  onLogin: (credentials: LoginCredentials) => Promise<void>
  onRegister: (credentials: RegisterCredentials) => Promise<void>
  onResetPassword: (credentials: LoginCredentials) => Promise<void>
  allowResetPassword?: boolean
  startupError?: string | null
}

export function AuthScreen({ onLogin, onRegister, onResetPassword, allowResetPassword = false, startupError = null }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: '',
      password: '',
      displayName: '',
    },
  })

  async function handleSubmit(values: AuthValues) {
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await onLogin({ username: values.username, password: values.password })
      } else if (mode === 'reset') {
        if (!allowResetPassword) {
          throw new Error('Reset hasła jest wyłączony w tym trybie.')
        }

        await onResetPassword({ username: values.username, password: values.password })
      } else {
        await onRegister({ username: values.username, password: values.password, displayName: values.displayName })
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nie udało się wykonać operacji')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4 py-6 sm:px-6">
      <Card className="w-full bg-white/92">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md space-y-7">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-zinc-900 bg-zinc-950 px-3 py-2">
                <span className="text-3xl font-semibold tracking-[-0.08em] text-white sm:text-5xl">FURA</span>
              </div>
              <p className="text-base font-medium leading-7 text-zinc-950 sm:text-lg">Prosty dziennik serwisowy dla każdego auta.</p>
              <p className="text-sm leading-6 text-zinc-500">Zaloguj się lub utwórz profil.</p>
              {startupError ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{startupError}</p> : null}
            </div>

              <div className={`grid rounded-2xl bg-zinc-100 p-1 ${allowResetPassword ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  className={`rounded-[14px] px-4 py-3 text-sm font-medium transition ${mode === 'login' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                  onClick={() => setMode('login')}
                >
                  Logowanie
                </button>
                <button
                  type="button"
                  className={`rounded-[14px] px-4 py-3 text-sm font-medium transition ${mode === 'register' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                  onClick={() => setMode('register')}
                >
                  Rejestracja
                </button>
                {allowResetPassword ? (
                  <button
                    type="button"
                    className={`rounded-[14px] px-4 py-3 text-sm font-medium transition ${mode === 'reset' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                    onClick={() => setMode('reset')}
                  >
                    Reset
                  </button>
                ) : null}
              </div>

              <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                <div className="space-y-2">
                  <Label htmlFor="username">Nazwa użytkownika</Label>
                  <Input id="username" placeholder="np. kierowca01" {...form.register('username')} />
                  {form.formState.errors.username ? (
                    <p className="text-sm text-red-600">{form.formState.errors.username.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{mode === 'reset' ? 'Nowe hasło' : 'Hasło'}</Label>
                  <Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...form.register('password')} />
                  {form.formState.errors.password ? (
                    <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
                  ) : null}
                </div>

                {mode === 'register' ? (
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Nazwa wyświetlana</Label>
                    <Input id="displayName" placeholder="np. Mój profil" {...form.register('displayName')} />
                  </div>
                ) : null}

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <div className="flex flex-col gap-3 pt-2">
                  <Button type="submit" size="lg" disabled={isSubmitting}>
                    <KeyRound className="h-4 w-4" />
                    {mode === 'login' ? 'Zaloguj' : mode === 'register' ? 'Utwórz profil' : 'Zresetuj hasło'}
                  </Button>
                </div>
              </form>

          </div>
        </CardContent>
      </Card>
    </main>
  )
}
