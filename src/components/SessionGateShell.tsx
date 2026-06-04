import { BrandLogo } from '@/components/BrandLogo'
import { LoadingStatus } from '@/components/ui/LoadingStatus'
import { APP_NAME } from '@/lib/brand'

/** Branded shell while auth loads or session gate is active — no balances or nav. */
export default function SessionGateShell() {
  return (
    <div className="flex min-h-svh flex-col items-center overflow-y-auto bg-black px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] sm:justify-center sm:py-12">
      <div className="w-full max-w-sm text-center">
        <BrandLogo className="mx-auto mb-3" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-300">
          {APP_NAME}
        </h1>
        <div className="mt-8">
          <LoadingStatus />
        </div>
      </div>
    </div>
  )
}
