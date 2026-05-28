import { APP_NAME, APP_TAGLINE } from '@/lib/brand'

/** Logo, product name, and tagline for auth screens. */
export function AuthBrandHeader() {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-black shadow-sm">
        <span className="text-xl font-semibold">$</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-300">
        {APP_NAME}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">{APP_TAGLINE}</p>
    </div>
  )
}
