import { LoadingStatus } from '@/components/ui/LoadingStatus'

export default function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-start justify-center pt-12">
      <LoadingStatus />
    </div>
  )
}
