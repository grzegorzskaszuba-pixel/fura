import type { ReactNode } from 'react'

import { Card, CardContent } from '@/shared/components/ui/card'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-zinc-200 bg-white/80">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">{icon}</div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
          <p className="text-sm leading-6 text-zinc-500">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
