import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ResponsiveModal } from '@/shared/components/responsive-modal'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import type { UserProfile } from '@/shared/types/domain'

const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Nazwa użytkownika musi mieć co najmniej 2 znaki'),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
    newPassword: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
    confirmPassword: z.string().min(6, 'Powtórz hasło'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Nowe hasła muszą być takie same',
    path: ['confirmPassword'],
  })

type ProfileValues = z.infer<typeof profileSchema>
type PasswordValues = z.infer<typeof passwordSchema>

interface ProfileSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentProfile: UserProfile
  onUpdateProfile: (values: { displayName: string }) => Promise<void>
  onChangePassword: (values: { currentPassword: string; newPassword: string }) => Promise<void>
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
  currentProfile,
  onUpdateProfile,
  onChangePassword,
}: ProfileSettingsModalProps) {
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false)
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: currentProfile.displayName ?? currentProfile.username,
    },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    profileForm.reset({
      displayName: currentProfile.displayName ?? currentProfile.username,
    })
  }, [currentProfile.displayName, currentProfile.username, profileForm])

  async function handleProfileSubmit(values: ProfileValues) {
    setProfileError(null)
    setIsProfileSubmitting(true)

    try {
      await onUpdateProfile({ displayName: values.displayName })
      onOpenChange(false)
    } catch (submitError) {
      setProfileError(submitError instanceof Error ? submitError.message : 'Nie udało się zaktualizować profilu')
    } finally {
      setIsProfileSubmitting(false)
    }
  }

  async function handlePasswordSubmit(values: PasswordValues) {
    setPasswordError(null)
    setIsPasswordSubmitting(true)

    try {
      await onChangePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      passwordForm.reset()
    } catch (submitError) {
      setPasswordError(submitError instanceof Error ? submitError.message : 'Nie udało się zmienić hasła')
    } finally {
      setIsPasswordSubmitting(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setProfileError(null)
          setPasswordError(null)
          passwordForm.reset()
          profileForm.reset({
            displayName: currentProfile.displayName ?? currentProfile.username,
          })
        }

        onOpenChange(nextOpen)
      }}
      title="Mój profil"
      description="Edytuj nazwę użytkownika i zarządzaj hasłem."
    >
      <div className="space-y-6">
        <form className="space-y-4" onSubmit={profileForm.handleSubmit(handleProfileSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="username">E-mail użytkownika</Label>
            <Input id="username" value={currentProfile.username} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Nazwa użytkownika</Label>
            <Input id="display-name" {...profileForm.register('displayName')} />
            {profileForm.formState.errors.displayName ? (
              <p className="text-sm text-red-600">{profileForm.formState.errors.displayName.message}</p>
            ) : null}
          </div>

          {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isProfileSubmitting}>
              Zapisz profil
            </Button>
          </div>
        </form>

        <div className="h-px bg-zinc-200" />

        <form className="space-y-4" onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}>
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-500">Zmiana hasła</h3>

          <div className="space-y-2">
            <Label htmlFor="current-password">Obecne hasło</Label>
            <Input id="current-password" type="password" autoComplete="current-password" {...passwordForm.register('currentPassword')} />
            {passwordForm.formState.errors.currentPassword ? (
              <p className="text-sm text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Nowe hasło</Label>
            <Input id="new-password" type="password" autoComplete="new-password" {...passwordForm.register('newPassword')} />
            {passwordForm.formState.errors.newPassword ? (
              <p className="text-sm text-red-600">{passwordForm.formState.errors.newPassword.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Powtórz nowe hasło</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" {...passwordForm.register('confirmPassword')} />
            {passwordForm.formState.errors.confirmPassword ? (
              <p className="text-sm text-red-600">{passwordForm.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>

          {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPasswordSubmitting}>
              Zmień hasło
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveModal>
  )
}
