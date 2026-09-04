import { Drawer as DrawerPrimitive } from 'vaul'

import { cn } from '@/shared/lib/utils'

export const Drawer = DrawerPrimitive.Root
export const DrawerTrigger = DrawerPrimitive.Trigger
export const DrawerPortal = DrawerPrimitive.Portal
export const DrawerClose = DrawerPrimitive.Close
export const DrawerHandle = DrawerPrimitive.Handle

export function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return <DrawerPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/35', className)} {...props} />
}

export function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[92svh] flex-col rounded-t-[32px] bg-card px-5 pb-6 pt-3 shadow-[0_-24px_60px_rgba(15,23,42,0.18)] outline-none',
          className,
        )}
        {...props}
      >
        <DrawerHandle className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

export function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-5 shrink-0 flex flex-col gap-1.5', className)} {...props} />
}

export function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title className={cn('text-xl font-semibold text-zinc-950', className)} {...props} />
}

export function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description className={cn('text-sm text-zinc-500', className)} {...props} />
}
