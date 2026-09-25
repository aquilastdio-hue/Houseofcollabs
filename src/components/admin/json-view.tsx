import * as React from 'react'
import { Braces } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CopyButton } from './detail'

function JsonNode({ value, depth }: { value: unknown; depth: number }): React.ReactNode {
  const pad = '  '.repeat(depth + 1)
  const close = '  '.repeat(depth)
  if (value === null || value === undefined) return <span className="text-faint">null</span>
  if (typeof value === 'string') return <span className="text-mint">{JSON.stringify(value)}</span>
  if (typeof value === 'number') return <span className="text-sky">{value}</span>
  if (typeof value === 'boolean') return <span className="text-peach">{String(value)}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>[]</span>
    return (
      <>
        {'[\n'}
        {value.map((v, i) => (
          <React.Fragment key={i}>
            {pad}
            <JsonNode value={v} depth={depth + 1} />
            {i < value.length - 1 ? ',\n' : '\n'}
          </React.Fragment>
        ))}
        {close}]
      </>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span>{'{}'}</span>
    return (
      <>
        {'{\n'}
        {entries.map(([k, v], i) => (
          <React.Fragment key={k}>
            {pad}
            <span className="text-lilac">{JSON.stringify(k)}</span>: <JsonNode value={v} depth={depth + 1} />
            {i < entries.length - 1 ? ',\n' : '\n'}
          </React.Fragment>
        ))}
        {close}
        {'}'}
      </>
    )
  }
  return <span>{String(value)}</span>
}

/** Pretty, colour-coded JSON (read-only). */
export function JsonView({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={cn('overflow-auto rounded-control border border-line bg-subtle p-4 font-mono text-xs leading-relaxed whitespace-pre text-ink-soft', className)}>
      <JsonNode value={value} depth={0} />
    </pre>
  )
}

export function isEmptyJson(value: unknown) {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

/** Button that opens a dialog with the pretty-printed JSON and a copy action. */
export function JsonDialogButton({ value, title, description, label = 'View' }: { value: unknown; title: string; description?: string; label?: string }) {
  const [open, setOpen] = React.useState(false)
  const text = React.useMemo(() => JSON.stringify(value ?? null, null, 2), [value])
  return (
    <>
      <Button
        variant="secondary"
        size="xs"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Braces /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description ?? 'Raw metadata recorded with this entry.'}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="mb-2 flex justify-end">
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                Copy JSON <CopyButton value={text} label="Copy JSON" />
              </span>
            </div>
            <JsonView value={value} className="max-h-[60dvh]" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
