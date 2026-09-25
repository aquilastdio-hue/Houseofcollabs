import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, FileCheck2, FileText, Image as ImageIcon, Loader2, Video, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { BUCKET_RULES } from '@/lib/validation/files'
import { uploadApplicationFile } from '@/services/applications.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

/**
 * Shared controls for the creator and brand sign-ups. Kept apart from the pages
 * so each page reads as the questions it asks rather than as markup.
 */

const ACCEPT = {
  video: 'video/mp4,video/quicktime,video/webm',
  image: 'image/jpeg,image/png,image/webp',
  document: 'application/pdf,image/jpeg,image/png',
} as const

const DESCRIBE = {
  video: 'MP4, MOV or WebM',
  image: 'JPG, PNG or WebP',
  document: 'PDF, JPG or PNG',
} as const

type FileKind = keyof typeof ACCEPT

const ICON = { video: Video, image: ImageIcon, document: FileText } as const

// ------------------------------------------------------------ single file --
export function FileDrop({
  kind,
  path,
  onUploaded,
  onClear,
  label,
  hint,
}: {
  kind: FileKind
  path: string
  onUploaded: (path: string, name: string) => void
  onClear: () => void
  label: string
  hint?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [name, setName] = React.useState<string | null>(null)
  const upload = useMutation({
    mutationFn: (file: File) => uploadApplicationFile(file),
    onSuccess: (p, file) => {
      setError(null)
      setName(file.name)
      onUploaded(p, file.name)
    },
    onError: (e) => setError(toAppError(e).message),
  })
  const max = BUCKET_RULES.applications.maxBytes / (1024 * 1024)
  const Icon = ICON[kind]

  if (path) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-subtle px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <FileCheck2 className="size-4 shrink-0 text-success" aria-hidden />
          <span className="truncate">{name ?? `${label} uploaded`}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setName(null)
            onClear()
          }}
          aria-label={`Remove ${label}`}
        >
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload.mutate(file)
        }}
      />
      <Button type="button" variant="secondary" block disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
        {upload.isPending ? <Loader2 className="animate-spin" /> : <Icon />}
        {upload.isPending ? 'Uploading…' : label}
      </Button>
      <p className={cn('mt-1.5 text-xs', error ? 'text-danger' : 'text-muted')}>
        {error ?? hint ?? `${DESCRIBE[kind]}, up to ${max} MB.`}
      </p>
    </div>
  )
}

// ------------------------------------------------------------- many files --
/**
 * Several files at once — the document is explicit that a creator shouldn't be
 * made to add them one at a time, so the picker is multiple and uploads run
 * together. Each file's outcome is independent: one rejection doesn't discard
 * the others.
 */
export function MultiFileDrop({
  kind,
  value,
  onChange,
  max: maxFiles,
  label,
}: {
  kind: 'video' | 'image'
  value: string[]
  onChange: (next: string[]) => void
  max: number
  label: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [errors, setErrors] = React.useState<string[]>([])
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(0)
  const maxMb = BUCKET_RULES.applications.maxBytes / (1024 * 1024)
  const room = maxFiles - value.length

  const add = async (files: File[]) => {
    const taking = files.slice(0, room)
    const skipped = files.length - taking.length
    setErrors(skipped > 0 ? [`Only ${maxFiles} allowed — ${skipped} not added.`] : [])
    setBusy((n) => n + taking.length)

    const results = await Promise.allSettled(taking.map((f) => uploadApplicationFile(f)))
    const added: string[] = []
    const failed: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        added.push(r.value)
        setNames((prev) => ({ ...prev, [r.value]: taking[i].name }))
      } else {
        failed.push(`${taking[i].name}: ${toAppError(r.reason).message}`)
      }
    })
    setBusy((n) => n - taking.length)
    if (added.length) onChange([...value, ...added])
    if (failed.length) setErrors((prev) => [...prev, ...failed])
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((p) => (
            <li key={p} className="flex items-center justify-between gap-3 rounded-control border border-line bg-subtle px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileCheck2 className="size-4 shrink-0 text-success" aria-hidden />
                <span className="truncate">{names[p] ?? p}</span>
              </span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => onChange(value.filter((x) => x !== p))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT[kind]}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) void add(files)
        }}
      />
      <Button type="button" variant="secondary" block disabled={busy > 0 || room <= 0} onClick={() => inputRef.current?.click()}>
        {busy > 0 ? <Loader2 className="animate-spin" /> : kind === 'video' ? <Video /> : <ImageIcon />}
        {busy > 0 ? `Uploading ${busy}…` : room <= 0 ? `${maxFiles} added` : label}
      </Button>

      <p className={cn('text-xs', errors.length ? 'text-danger' : 'text-muted')}>
        {errors.length ? errors.join(' ') : `${DESCRIBE[kind]}, up to ${maxMb} MB each. ${value.length} of ${maxFiles} added.`}
      </p>
    </div>
  )
}

// ------------------------------------------------------------------- chips --
/** Multi-select as chips rather than a dropdown. */
export function Chips({
  options,
  value,
  onChange,
  max,
  name,
}: {
  options: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  name: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={name}>
      {options.map((o) => {
        const on = value.includes(o)
        const full = !on && max !== undefined && value.length >= max
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            disabled={full}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              'rounded-pill border px-3.5 py-1.5 text-sm transition-colors',
              on ? 'border-transparent bg-ink text-white' : 'border-line bg-surface text-ink-soft hover:border-ink/30',
              full && 'cursor-not-allowed opacity-40',
            )}
          >
            {on && <Check className="mr-1 inline size-3.5" aria-hidden />}
            {o}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------- money --
export function Money({
  id,
  value,
  onChange,
  placeholder = '0',
  invalid,
  disabled,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted" aria-hidden>
        ₹
      </span>
      <Input
        id={id}
        inputMode="numeric"
        className="pl-7"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ------------------------------------------------------------------ choice --
/** A row of radio options — a circle and a label, laid out across. */
export function RadioRow({
  value,
  onChange,
  options,
  name,
  label,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly { value: string; label: string }[]
  name: string
  label: string
  className?: string
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className={cn('grid-flow-col auto-cols-max gap-x-7', className)}
      aria-label={label}
    >
      {options.map((o) => (
        <div key={o.value} className="flex items-center gap-2">
          <RadioGroupItem value={o.value} id={`${name}-${o.value}`} />
          <label htmlFor={`${name}-${o.value}`} className="cursor-pointer text-sm text-ink">
            {o.label}
          </label>
        </div>
      ))}
    </RadioGroup>
  )
}

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

/** The "Available?" answer for one collaboration. */
export function YesNo({
  value,
  onChange,
  name,
  label,
}: {
  value: boolean
  onChange: (v: boolean) => void
  name: string
  label: string
}) {
  return <RadioRow value={value ? 'yes' : 'no'} onChange={(v) => onChange(v === 'yes')} options={YES_NO} name={name} label={label} />
}
