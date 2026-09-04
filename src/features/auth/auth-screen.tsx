import { zodResolver } from '@hookform/resolvers/zod'
import { CarFront, KeyRound, UserCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import type { ProfileCredentials } from '@/shared/types/domain'

const authSchema = z.object({
  username: z.string().trim().min(2, 'Podaj nazwę użytkownika'),
  displayName: z.string().trim().optional(),
})

type AuthValues = z.infer<typeof authSchema>

interface AuthScreenProps {
  onLogin: (credentials: ProfileCredentials) => Promise<void>
  onRegister: (credentials: ProfileCredentials) => Promise<void>
  onDemoLogin: () => Promise<void>
}

export function AuthScreen({ onLogin, onRegister, onDemoLogin }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: '',
      displayName: '',
    },
  })

  async function handleSubmit(values: AuthValues) {
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await onLogin({ username: values.username })
      } else {
        await onRegister(values)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nie udało się zalogować')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDemoLogin() {
    setError(null)
    setIsSubmitting(true)

    try {
      await onDemoLogin()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nie udało się uruchomić demo')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-6 sm:px-6 lg:px-8">
      <Card className="w-full overflow-hidden bg-white/92">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between gap-10 bg-zinc-950 px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
                <CarFront className="h-4 w-4 text-orange-400" />
                AUTOlog
              </div>
              <div className="space-y-4">
                <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
                  Prosty dziennik serwisowy dla każdego auta.
                </h1>
                <p className="max-w-md text-sm leading-7 text-zinc-300 sm:text-base">
                  Mobile-first, lokalny vertical slice i separacja danych per profil od pierwszego dnia.
                </p>
              </div>
            </div>
            <div className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">Karuzela aut i jeden ekran roboczy.</div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">Historia i plan w jednym przełączniku.</div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">Lokalne dane demo przez Dexie i IndexedDB.</div>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-md space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Start</p>
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-950">Mój profil</h2>
                <p className="text-sm leading-6 text-zinc-500">
                  Demo auth nie przechowuje haseł lokalnie. Prawdziwe logowanie wymaga backendu.
                </p>
              </div>

              <div className="grid grid-cols-2 rounded-2xl bg-zinc-100 p-1">
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
              </div>

              <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                <div className="space-y-2">
                  <Label htmlFor="username">Nazwa użytkownika</Label>
                  <Input id="username" placeholder="np. demo" {...form.register('username')} />
                  {form.formState.errors.username ? (
                    <p className="text-sm text-red-600">{form.formState.errors.username.message}</p>
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
                    {mode === 'login' ? 'Zaloguj' : 'Utwórz profil'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    data-testid="demo-login"
                    disabled={isSubmitting}
                    onClick={handleDemoLogin}
                  >
                    <UserCircle2 className="h-4 w-4" />
                    Wejdź w demo
                  </Button>
                </div>
              </form>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                Szybki start: użyj konta <span className="font-semibold text-zinc-900">demo</span> albo utwórz lokalny profil bez hasła.
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    </main>
  )
}
