import * as React from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/** Chart palette derived from design tokens (Recharts needs raw values). */
export const CHART_COLORS = {
  ink: '#111111',
  brand: '#c13584',
  lilac: '#6a4fd1',
  sky: '#2f67d8',
  peach: '#d4622f',
  mint: '#1d8656',
  grid: '#e7e4ee',
  axis: '#9c95a8',
} as const

type Series = { key: string; label: string; color?: keyof typeof CHART_COLORS }

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-float">
      <p className="mb-1 font-medium text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-medium text-ink tabular-nums">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  )
}

export function ChartCard({
  title,
  description,
  action,
  loading,
  className,
  children,
  height = 260,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  loading?: boolean
  className?: string
  children: React.ReactNode
  height?: number
}) {
  return (
    <section className={cn('rounded-card border border-line bg-surface p-5 shadow-card', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div style={{ height }} role="img" aria-label={title}>
        {loading ? <Skeleton className="size-full" /> : children}
      </div>
    </section>
  )
}

export function AreaTrend<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  format = (v) => String(v),
  xFormat,
}: {
  data: T[]
  xKey: keyof T & string
  series: Series[]
  format?: (v: number) => string
  xFormat?: (v: string) => string
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[s.color ?? 'ink']} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART_COLORS[s.color ?? 'ink']} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey as never} tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={xFormat} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={(v) => format(Number(v))} width={56} />
        <Tooltip content={<ChartTooltip format={format} />} labelFormatter={(l) => (xFormat ? xFormat(String(l)) : String(l))} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={CHART_COLORS[s.color ?? 'ink']}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function Bars<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  format = (v) => String(v),
  xFormat,
  stacked,
}: {
  data: T[]
  xKey: keyof T & string
  series: Series[]
  format?: (v: number) => string
  xFormat?: (v: string) => string
  stacked?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey as never} tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={xFormat} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={(v) => format(Number(v))} width={48} allowDecimals={false} />
        <Tooltip cursor={{ fill: CHART_COLORS.grid, opacity: 0.4 }} content={<ChartTooltip format={format} />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? 'a' : undefined}
            fill={CHART_COLORS[s.color ?? 'ink']}
            radius={stacked && i < series.length - 1 ? 0 : [6, 6, 0, 0]}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
