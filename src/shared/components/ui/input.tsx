import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-12 w-full rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-orange-300 focus:ring-1 focus:ring-inset focus:ring-orange-300',
          className,
        )}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
