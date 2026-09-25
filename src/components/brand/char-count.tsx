import { useWatch, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'

/** Live "120/2,000" counter for a text field; only the counter re-renders. */
export function CharCount<T extends FieldValues>({ control, name, max }: { control: Control<T>; name: FieldPath<T>; max: number }) {
  const value: unknown = useWatch({ control, name })
  const length = typeof value === 'string' ? value.trim().length : 0
  return (
    <span className={cn('text-xs tabular-nums', length > max ? 'font-medium text-danger' : 'text-faint')}>
      {formatNumber(length)}/{formatNumber(max)}
    </span>
  )
}
