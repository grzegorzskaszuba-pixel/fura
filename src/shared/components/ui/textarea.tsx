import type { TextareaHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-orange-300 focus:ring-1 focus:ring-inset focus:ring-orange-300',
        className,
      )}
      {...props}
    />
  )
}
