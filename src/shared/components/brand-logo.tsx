import { useEffect, useState } from 'react'

import { cn } from '@/shared/lib/utils'

const LOGO_PHASE_INTERVAL_MS = 10000
const logoPhases = ['pill', 'icon'] as const
type LogoPhase = (typeof logoPhases)[number]

export function BrandLogo() {
  const [logoPhaseIndex, setLogoPhaseIndex] = useState(0)
  const logoPhase: LogoPhase = logoPhases[logoPhaseIndex]

  useEffect(() => {
    const phaseInterval = window.setInterval(() => {
      setLogoPhaseIndex((previousIndex) => (previousIndex + 1) % logoPhases.length)
    }, LOGO_PHASE_INTERVAL_MS)

    return () => {
      window.clearInterval(phaseInterval)
    }
  }, [])

  return (
    <div className="relative inline-flex h-14 w-[188px] items-center justify-end" aria-label="Branding FURA">
      <span
        aria-hidden="true"
        className={cn(
          'absolute right-0 top-1/2 inline-flex h-14 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-white p-2 text-white shadow-sm ring-1 ring-zinc-200/80 transition-all duration-700 ease-in-out',
          logoPhase === 'pill' ? 'w-[152px] opacity-100' : 'w-14 opacity-100',
        )}
      >
        <span className="absolute inset-2 rounded-full bg-zinc-950" />
        <span
          className={cn(
            'absolute inset-0 z-10 grid place-items-center text-[30px] font-semibold leading-none tracking-[-0.06em] transition-opacity duration-500',
            logoPhase === 'pill' ? 'opacity-100' : 'opacity-0',
          )}
        >
          FURA
        </span>
        <span
          className={cn(
            'absolute inset-0 z-10 grid place-items-center text-[30px] font-semibold leading-none tracking-[-0.03em] transition-opacity duration-500',
            logoPhase === 'icon' ? 'opacity-100' : 'opacity-0',
          )}
        >
          F
        </span>
      </span>
    </div>
  )
}