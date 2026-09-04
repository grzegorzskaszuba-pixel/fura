import { ChevronDown, LogOut, UserCircle2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { UserProfile } from '@/shared/types/domain'

interface ProfileMenuProps {
  currentProfile: UserProfile
  profiles: UserProfile[]
  onProfileSelect: (profileId: string) => void
  onLogout: () => void
}

export function ProfileMenu({ currentProfile, profiles, onProfileSelect, onLogout }: ProfileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-white p-2 shadow-sm ring-1 ring-zinc-200/80 transition hover:ring-zinc-300 sm:gap-3 sm:px-3 sm:py-2"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-white">
            <UserCircle2 className="h-5 w-5" />
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold text-zinc-950">{currentProfile.displayName ?? currentProfile.username}</span>
            <span className="block text-xs text-zinc-500">Mój profil</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-zinc-500 sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Profile lokalne</DropdownMenuLabel>
        {profiles.map((profile) => (
          <DropdownMenuCheckboxItem
            key={profile.id}
            checked={profile.id === currentProfile.id}
            onCheckedChange={() => onProfileSelect(profile.id)}
          >
            <div>
              <div className="font-medium text-zinc-900">{profile.displayName ?? profile.username}</div>
              <div className="text-xs text-zinc-500">@{profile.username}</div>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Wyloguj
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
