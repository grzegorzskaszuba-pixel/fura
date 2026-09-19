import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Mail } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ResponsiveModal } from '@/shared/components/responsive-modal'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog'
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
const ACCOUNT_REPORT_EXPORT_PROMPT_ENABLED = false

interface ProfileSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentProfile: UserProfile
  onUpdateProfile: (values: { displayName: string }) => Promise<void>
  onChangePassword: (values: { currentPassword: string; newPassword: string }) => Promise<void>
  onRequestPasswordReset: (email: string) => Promise<void>
  allowPasswordReset?: boolean
  onDeleteAccount: () => Promise<void>
  onExportAccountReport?: () => Promise<void>
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
  currentProfile,
  onUpdateProfile,
  onChangePassword,
  onRequestPasswordReset,
  allowPasswordReset = false,
  onDeleteAccount,
  onExportAccountReport,
}: ProfileSettingsModalProps) {
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null)
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false)
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)
  const [isPasswordResetSubmitting, setIsPasswordResetSubmitting] = useState(false)
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false)
  const [isExportSubmitting, setIsExportSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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

  async function handlePasswordResetRequest() {
    setPasswordResetMessage(null)
    setPasswordResetError(null)
    setIsPasswordResetSubmitting(true)

    try {
      await onRequestPasswordReset(currentProfile.username)
      setPasswordResetMessage('Jeśli konto jest przypisane do tego adresu, link resetujący został wysłany. Link jest ważny przez 30 minut.')
    } catch (requestError) {
      setPasswordResetError(requestError instanceof Error ? requestError.message : 'Nie udało się wysłać linku resetującego.')
    } finally {
      setIsPasswordResetSubmitting(false)
    }
  }

  async function handleDeleteAccount(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDeleteError(null)
    setIsDeleteSubmitting(true)

    try {
      await onDeleteAccount()
      setDeleteDialogOpen(false)
    } catch (submitError) {
      setDeleteError(submitError instanceof Error ? submitError.message : 'Nie udało się usunąć konta')
    } finally {
      setIsDeleteSubmitting(false)
    }
  }

  async function handleExportAccountReport() {
    if (!onExportAccountReport) {
      return
    }

    setIsExportSubmitting(true)

    try {
      await onExportAccountReport()
    } finally {
      setIsExportSubmitting(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setProfileError(null)
          setPasswordError(null)
          setPasswordResetMessage(null)
          setPasswordResetError(null)
          setDeleteError(null)
          setDeleteDialogOpen(false)
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

        {allowPasswordReset ? (
          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-500">Reset hasła przez e-mail</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Wyślemy jednorazowy link na adres {currentProfile.username}. Link będzie ważny przez 30 minut.</p>
            </div>
            {passwordResetMessage ? <p className="text-sm text-emerald-700">{passwordResetMessage}</p> : null}
            {passwordResetError ? <p className="text-sm text-red-600">{passwordResetError}</p> : null}
            <Button type="button" variant="outline" disabled={isPasswordResetSubmitting} onClick={() => void handlePasswordResetRequest()}>
              {isPasswordResetSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isPasswordResetSubmitting ? 'Wysyłanie...' : 'Wyślij link resetujący'}
            </Button>
          </section>
        ) : null}

        <div className="h-px bg-zinc-200" />

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-red-700">Usuń konto użytkownika</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Usunięcie konta jest permanentne. Wszystkie dane konta, samochody, wpisy serwisowe, zdjęcia i załączniki zostaną usunięte bez możliwości przywrócenia.
            </p>
          </div>

          <Button type="button" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            Usuń konto bezpowrotnie
          </Button>
        </section>
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          setDeleteDialogOpen(nextOpen)
          if (!nextOpen) {
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć konto użytkownika?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć konto? Ta operacja jest permanentna i bezpowrotnie usunie profil, samochody, wpisy serwisowe, zdjęcia, załączniki oraz pozostałe dane.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {ACCOUNT_REPORT_EXPORT_PROMPT_ENABLED && onExportAccountReport ? (
            <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm text-zinc-700">Czy przed usunięciem chcesz wyeksportować raport swoich samochodów do pliku?</p>
              <Button type="button" variant="outline" disabled={isExportSubmitting} onClick={() => void handleExportAccountReport()}>
                Wyeksportuj raport
              </Button>
            </div>
          ) : null}

          {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="ghost" disabled={isDeleteSubmitting}>
                Anuluj
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" disabled={isDeleteSubmitting} onClick={handleDeleteAccount}>
                {isDeleteSubmitting ? 'Usuwanie...' : 'Usuń konto bezpowrotnie'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveModal>
  )
}
