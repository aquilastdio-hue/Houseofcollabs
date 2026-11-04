import { FlaskConical } from 'lucide-react'
import { isStaging } from '@/config/site'

/**
 * Bottom-left on every page of the staging site, so nobody mistakes it for
 * houseofcollabs.com. Nothing on production.
 */
export function EnvironmentBadge() {
  if (!isStaging) return null
  return (
    <div
      role="note"
      className="pointer-events-none fixed bottom-3 left-3 z-[100] flex items-center gap-1.5 rounded-pill bg-warning px-3 py-1.5 text-xs font-semibold text-white shadow-float"
    >
      <FlaskConical className="size-3.5" aria-hidden /> Testing site · not houseofcollabs.com
    </div>
  )
}
