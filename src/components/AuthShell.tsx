import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/BrandLogo'

type AuthShellProps = {
  title?: string
  subtitle?: string
  /** When false, only the card (or children) is shown — e.g. bare join loading. */
  showHeader?: boolean
  children: ReactNode
}

/** Auth layout: scrollable and top-aligned on phones; centered on wider screens. */
export function AuthShell({
  title,
  subtitle,
  showHeader = true,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-svh flex-col overflow-y-auto bg-black px-4 pb-[max(1.5rem,var(--keyboard-inset,0px))] pt-[max(2rem,env(safe-area-inset-top,0px))] sm:justify-center sm:py-12">
      <div className="w-full max-w-sm">
        {showHeader ? (
          <>
            <div className="mb-8 text-center">
              <BrandLogo className="mx-auto mb-3" />
              {title ? (
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-300">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
              ) : null}
            </div>
            <div className="rounded-2xl bg-zinc-900 p-6 shadow-lg ring-1 ring-zinc-800">
              {children}
            </div>
          </>
        ) : (
          <div className="text-center">{children}</div>
        )}
      </div>
    </div>
  )
}
