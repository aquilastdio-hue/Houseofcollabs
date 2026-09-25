import * as React from 'react'
import { Slider } from '@/components/ui/slider'

/**
 * Two-thumb range with formatted labels. Emits `undefined` for a bound that is
 * at the extreme (meaning "no limit"), which maps cleanly to URL params.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (n) => String(n),
  label,
}: {
  min: number
  max: number
  step?: number
  value: [number | undefined, number | undefined]
  onChange: (value: [number | undefined, number | undefined]) => void
  format?: (n: number) => string
  label: string
}) {
  const [local, setLocal] = React.useState<[number, number]>([value[0] ?? min, value[1] ?? max])
  React.useEffect(() => setLocal([value[0] ?? min, value[1] ?? max]), [value, min, max])
  return (
    <div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={local}
        minStepsBetweenThumbs={1}
        thumbLabels={[`Minimum ${label}`, `Maximum ${label}`]}
        onValueChange={(v) => setLocal([v[0]!, v[1]!])}
        onValueCommit={(v) => onChange([v[0]! <= min ? undefined : v[0], v[1]! >= max ? undefined : v[1]])}
      />
      <div className="mt-1 flex justify-between text-xs text-muted tabular-nums">
        <span>{local[0] <= min ? 'Any' : format(local[0])}</span>
        <span>{local[1] >= max ? `${format(max)}+` : format(local[1])}</span>
      </div>
    </div>
  )
}
