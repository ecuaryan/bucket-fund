import { formatAppVersion } from '@/lib/appVersion'

/** Build label for support — shown at the bottom of Settings (all roles). */
export default function AppVersionFooter({ className = 'pt-6' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-zinc-600 ${className}`}>
      Version {formatAppVersion()}
    </p>
  )
}
