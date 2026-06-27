import AppVersionFooter from '@/components/AppVersionFooter'
import DemoHideAmountsToggle from '@/components/DemoHideAmountsToggle'
import DevToastPreview from '@/components/DevToastPreview'
import BiometricSettingsCard from '@/features/settings/BiometricSettingsCard'
import PinSettingsCard from '@/features/settings/PinSettingsCard'
import { SETTINGS_PAGE_TITLE } from '@/lib/brand'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{SETTINGS_PAGE_TITLE}</h1>
      </header>

      <DevToastPreview />

      <DemoHideAmountsToggle />

      <PinSettingsCard />

      <BiometricSettingsCard />

      <AppVersionFooter />
    </div>
  )
}
