import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuContent = ({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      className={cn('z-50 min-w-56 rounded-2xl border border-white/80 bg-card p-2 shadow-[0_18px_60px_rgba(15,23,42,0.14)] outline-none', className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
)

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400', className)} {...props} />
}

export function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-default select-none items-center rounded-xl px-3 py-2.5 text-sm text-zinc-700 outline-none transition hover:bg-zinc-100 focus:bg-zinc-100',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuCheckboxItem({ className, checked, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn('relative flex cursor-default select-none items-center rounded-xl py-2.5 pl-8 pr-3 text-sm text-zinc-700 outline-none transition hover:bg-zinc-100 focus:bg-zinc-100', className)}
      {...props}
    >
      <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn('my-2 h-px bg-zinc-100', className)} {...props} />
}
