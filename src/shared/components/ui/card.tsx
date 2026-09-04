import type { HTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[28px] border border-white/80 bg-card shadow-[0_12px_40px_rgba(15,23,42,0.06)]', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
