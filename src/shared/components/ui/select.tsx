import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { cn } from '@/shared/lib/utils'

export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn('flex h-12 w-full items-center justify-between rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none transition focus:border-orange-300 focus:ring-1 focus:ring-inset focus:ring-orange-300', className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="h-4 w-4 text-zinc-500" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({ className, children, position, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const resolvedPosition = position ?? (isMobile ? 'item-aligned' : 'popper')

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={resolvedPosition}
        className={cn('z-[70] overflow-hidden rounded-2xl border border-white/80 bg-card shadow-[0_18px_60px_rgba(15,23,42,0.14)]', className)}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-8 items-center justify-center text-zinc-500">
          <ChevronUp className="h-4 w-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            'overflow-y-auto overscroll-contain p-2 touch-pan-y',
            isMobile ? 'max-h-72' : 'max-h-[min(18rem,var(--radix-select-content-available-height))]',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-8 items-center justify-center text-zinc-500">
          <ChevronDown className="h-4 w-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn('relative flex cursor-default select-none items-center rounded-xl py-2.5 pl-8 pr-3 text-sm text-zinc-700 outline-none transition hover:bg-zinc-100 focus:bg-zinc-100', className)}
      {...props}
    >
      <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}
