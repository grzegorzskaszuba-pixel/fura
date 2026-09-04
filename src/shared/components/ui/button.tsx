import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-orange-500',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-zinc-800',
        outline: 'border border-border bg-card text-foreground hover:bg-zinc-50',
        ghost: 'text-foreground hover:bg-zinc-100',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-red-700',
      },
      size: {
        default: 'h-12 px-4',
        sm: 'h-10 rounded-xl px-3 text-xs',
        lg: 'h-14 px-6 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'

  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
