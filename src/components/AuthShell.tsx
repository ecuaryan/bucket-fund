import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/BrandLogo'

type AuthShellProps = {
  title?: string
  subtitle?: string
  /** When false, only the card (or children) is shown — e.g. bare join loading. */
  showHeader?: boolean
  children: ReactNode
}

/** Centered auth layout: logo, optional title, zinc card. */
export function AuthShell({
  title,
  subtitle,
  showHeader = true,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-black px-4 py-12">
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
