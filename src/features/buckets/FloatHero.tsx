import InfoIconButton from '@/components/ui/InfoIconButton'
import RefreshIcon from '@/components/ui/RefreshIcon'
import {
  bucketsFloatInfoAriaLabel,
  floatRefreshedLabel,
  FLOAT_REFRESH_BALANCES_LABEL,
} from '@/lib/brand'

type FloatHeroProps = {
  floatLabel: string
  amount: string
  floatColorClass: string
  cashSubtext: string | null
  hint: string | null
  onInfoClick: () => void
  bankSyncedLabel: string | null
  canRefresh: boolean
  syncing: boolean
  refreshError: string | null
  onRefresh: () => void
}

function floatRefreshAriaLabel(bankSyncedLabel: string | null): string {
  if (bankSyncedLabel) {
    return `${FLOAT_REFRESH_BALANCES_LABEL} · last updated ${bankSyncedLabel}`
  }
  return FLOAT_REFRESH_BALANCES_LABEL
}

function floatRefreshVisibleLabel(bankSyncedLabel: string | null): string {
  if (bankSyncedLabel) {
    return floatRefreshedLabel(bankSyncedLabel)
  }
  return FLOAT_REFRESH_BALANCES_LABEL
}

export default function FloatHero({
  floatLabel,
  amount,
  floatColorClass,
  cashSubtext,
  hint,
  onInfoClick,
  bankSyncedLabel,
  canRefresh,
  syncing,
  refreshError,
  onRefresh,
}: FloatHeroProps) {
  return (
    <section
      className={`rounded-2xl px-4 py-5 ring-1 ${floatColorClass}`}
      aria-label={`${floatLabel} balance`}
    >
      <div className="flex items-center gap-0.5">
        <p className="text-xs font-medium uppercase leading-4 tracking-wide opacity-70">
          {floatLabel}
        </p>
        <InfoIconButton
          label={bucketsFloatInfoAriaLabel()}
          onClick={onInfoClick}
          className="-mt-px"
        />
      </div>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{amount}</p>
      {hint ? <p className="mt-1 text-xs leading-4 opacity-70">{hint}</p> : null}
      {cashSubtext || canRefresh ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          {cashSubtext ? (
            <p className="min-w-0 flex-1 text-xs leading-4 opacity-70">
              {cashSubtext}
            </p>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden="true" />
          )}
          {canRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              aria-label={floatRefreshAriaLabel(bankSyncedLabel)}
              className={
                'inline-flex h-4 shrink-0 items-center gap-1 rounded-md px-1 ' +
                'text-xs leading-4 opacity-70 transition hover:bg-current/10 ' +
                'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
              }
            >
              <span className="whitespace-nowrap">
                {floatRefreshVisibleLabel(bankSyncedLabel)}
              </span>
              <RefreshIcon spinning={syncing} className="h-3.5 w-3.5 shrink-0" />
            </button>
          ) : null}
        </div>
      ) : null}
      {refreshError ? (
        <p className="mt-1.5 text-[11px] text-red-300/80">{refreshError}</p>
      ) : null}
    </section>
  )
}
