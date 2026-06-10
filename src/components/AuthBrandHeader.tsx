import { BrandLogo } from '@/components/BrandLogo'
import {
  APP_NAME,
  LOGIN_TAGLINE_LEAD,
  LOGIN_TAGLINE_PAYOFF,
} from '@/lib/brand'

/** Logo, product name, and tagline for auth screens. */
export function AuthBrandHeader() {
  return (
    <div className="mb-8 text-center">
      <BrandLogo className="mx-auto mb-3" />
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-300">
        {APP_NAME}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        <span className="block">{LOGIN_TAGLINE_LEAD}</span>
        <span className="block">{LOGIN_TAGLINE_PAYOFF}</span>
      </p>
    </div>
  )
}
