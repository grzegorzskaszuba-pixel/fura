import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ResponsiveModal } from '@/shared/components/responsive-modal'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
    newPassword: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
    confirmPassword: z.string().min(6, 'Powtórz hasło'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Nowe hasła muszą być takie same',
    path: ['confirmPassword'],
  })

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

interface ChangePasswordFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: { currentPassword: string; newPassword: string }) => Promise<void>
}

export function ChangePasswordForm({ open, onOpenChange, onSubmit }: ChangePasswordFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function handleSubmit(values: ChangePasswordValues) {
    setError(null)
    setIsSubmitting(true)

    try {
      await onSubmit({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      form.reset()
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nie udało się zmienić hasła')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          form.reset()
          setError(null)
        }

        onOpenChange(nextOpen)
      }}
      title="Zmiana hasła"
      description="Potwierdź obecne hasło i ustaw nowe."
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="current-password">Obecne hasło</Label>
          <Input id="current-password" type="password" autoComplete="current-password" {...form.register('currentPassword')} />
          {form.formState.errors.currentPassword ? (
            <p className="text-sm text-red-600">{form.formState.errors.currentPassword.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">Nowe hasło</Label>
          <Input id="new-password" type="password" autoComplete="new-password" {...form.register('newPassword')} />
          {form.formState.errors.newPassword ? (
            <p className="text-sm text-red-600">{form.formState.errors.newPassword.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Powtórz nowe hasło</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          {form.formState.errors.confirmPassword ? (
            <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            Zmień hasło
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  )
}
