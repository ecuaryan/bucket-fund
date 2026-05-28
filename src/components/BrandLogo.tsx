import { PWA_ICON_192 } from '@/lib/brand'

type BrandLogoProps = {
  /** Display width/height in CSS pixels. Defaults to 48 (auth header). */
  size?: number
  className?: string
}

/** App icon mark — same asset as PWA manifest icon-192. */
export function BrandLogo({ size = 48, className = '' }: BrandLogoProps) {
  return (
    <img
      src={PWA_ICON_192}
      alt=""
      width={size}
      height={size}
      className={`rounded-2xl ${className}`.trim()}
    />
  )
}
