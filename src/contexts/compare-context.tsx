import * as React from 'react'
import { toast } from 'sonner'

export const MAX_COMPARE = 4
const STORAGE_KEY = 'house-of-collabs:compare'

type CompareItem = { id: string; name: string; image?: string | null }

type CompareContextValue = {
  items: CompareItem[]
  has: (id: string) => boolean
  toggle: (item: CompareItem) => void
  remove: (id: string) => void
  clear: () => void
}

const CompareContext = React.createContext<CompareContextValue | null>(null)

function read(): CompareItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as CompareItem[]) : []
    return Array.isArray(parsed) ? parsed.slice(0, MAX_COMPARE) : []
  } catch {
    return []
  }
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CompareItem[]>(read)

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore storage failures
    }
  }, [items])

  const value = React.useMemo<CompareContextValue>(
    () => ({
      items,
      has: (id) => items.some((i) => i.id === id),
      toggle: (item) =>
        setItems((prev) => {
          if (prev.some((i) => i.id === item.id)) return prev.filter((i) => i.id !== item.id)
          if (prev.length >= MAX_COMPARE) {
            toast.error(`You can compare up to ${MAX_COMPARE} creators.`)
            return prev
          }
          return [...prev, item]
        }),
      remove: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
      clear: () => setItems([]),
    }),
    [items],
  )

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare() {
  const ctx = React.useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used inside <CompareProvider>')
  return ctx
}
