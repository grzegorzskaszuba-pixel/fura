import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-medium', {
  variants: {
    variant: {
      neutral: 'bg-zinc-100 text-zinc-700',
      accent: 'bg-orange-50 text-orange-700',
      success: 'bg-emerald-50 text-emerald-700',
      warning: 'bg-amber-50 text-amber-700',
      danger: 'bg-rose-50 text-rose-700',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
})

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
