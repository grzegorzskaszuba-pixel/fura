import type { ReactNode } from 'react'

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
            <DrawerTitle>{title}</DrawerTitle>
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
        <DialogHeader>
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
