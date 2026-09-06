import { LogOut, UserCircle2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { UserProfile } from '@/shared/types/domain'

interface ProfileMenuProps {
  currentProfile: UserProfile
  onOpenProfile: () => void
  onLogout: () => void
}

export function ProfileMenu({ currentProfile, onOpenProfile, onLogout }: ProfileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu profilu"
          data-testid="profile-menu-trigger"
          className="inline-flex items-center justify-center rounded-full bg-white p-2 shadow-sm ring-1 ring-zinc-200/80 transition hover:ring-zinc-300"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-white">
            <UserCircle2 className="h-5 w-5" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={onOpenProfile}>
          <div>
            <div className="font-medium text-zinc-900">{currentProfile.displayName ?? currentProfile.username}</div>
            <div className="text-xs text-zinc-500">@{currentProfile.username}</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Wyloguj
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
