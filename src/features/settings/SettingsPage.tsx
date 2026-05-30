import DemoHideAmountsToggle from '@/components/DemoHideAmountsToggle'
import { SETTINGS_PAGE_TITLE } from '@/lib/brand'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{SETTINGS_PAGE_TITLE}</h1>
      </header>

      <DemoHideAmountsToggle />
    </div>
  )
}
