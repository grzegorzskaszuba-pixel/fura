import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { cn } from '@/shared/lib/utils'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger
export const AlertDialogPortal = AlertDialogPrimitive.Portal
export const AlertDialogAction = AlertDialogPrimitive.Action
export const AlertDialogCancel = AlertDialogPrimitive.Cancel

export function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return <AlertDialogPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]', className)} {...props} />
}

export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        className={cn('fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/80 bg-card p-6 shadow-[0_18px_60px_rgba(15,23,42,0.18)] outline-none', className)}
        {...props}
      />
    </AlertDialogPortal>
  )
}

export function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-5 flex flex-col gap-1.5', className)} {...props} />
}

export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cn('text-lg font-semibold text-zinc-950', className)} {...props} />
}

export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description className={cn('text-sm text-zinc-500', className)} {...props} />
}

export function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', className)} {...props} />
}