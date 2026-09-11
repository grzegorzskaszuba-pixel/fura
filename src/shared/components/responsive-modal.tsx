import type { ReactNode } from 'react'
import { X } from 'lucide-react'

import { useMediaQuery } from '@/shared/hooks/use-media-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer'

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: ResponsiveModalProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} fixed repositionInputs={false} handleOnly>
        <DrawerContent>
          <DrawerHeader>
            <div className="flex items-start justify-between gap-3">
              <DrawerTitle className="min-w-0 flex-1 pr-1">{title}</DrawerTitle>
              <DrawerClose
                aria-label="Zamknij"
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary bg-white text-zinc-950 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <X className="h-5 w-5" />
              </DrawerClose>
            </div>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <div className="-mx-1 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-1 pb-2 touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pr-12">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="-mr-2 min-h-0 overflow-x-hidden overflow-y-auto pr-2">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
