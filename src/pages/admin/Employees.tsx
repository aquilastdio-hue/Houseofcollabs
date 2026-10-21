import * as React from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, IdCard, Plus, Sparkles, UserPlus } from 'lucide-react'
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { listEmployeeReferrals, type EmployeeReferralRow } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { adminKeys } from '@/components/admin/admin-keys'
import { EmployeeDialog } from '@/components/admin/employee-dialog'

const sum = (rows: EmployeeReferralRow[], key: 'onboarded' | 'onboarded_this_month' | 'pending_applications') =>
  rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

const count = (n: number | null | undefined) => <span className="tabular-nums">{formatNumber(Number(n ?? 0))}</span>

function LastOnboarded({ at }: { at: string | null }) {
  return at ? (
    <span className="whitespace-nowrap text-muted" title={formatDateTime(at)}>
      {formatRelative(at)}
    </span>
  ) : (
    <span className="text-faint">Never</span>
  )
}

const employeeColumns: Column<EmployeeReferralRow & { rank: number }>[] = [
  { key: 'rank', header: '#', className: 'w-10 tabular-nums text-muted', cell: (r) => r.rank },
  {
    key: 'employee',
    header: 'Employee',
    cell: (r) => (
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{r.full_name}</span>
          {!r.active && (
            <Badge tone="neutral" size="sm">
              Inactive
            </Badge>
          )}
        </p>
        {(r.phone || r.email) && <p className="truncate text-xs text-muted">{[r.phone, r.email].filter(Boolean).join(' · ')}</p>}
      </div>
    ),
  },
  { key: 'code', header: 'Code', cell: (r) => <span className="font-mono text-sm tracking-wide">{r.referral_code}</span> },
  { key: 'onboarded', header: 'Onboarded', className: 'font-semibold', cell: (r) => count(r.onboarded) },
  { key: 'live', header: 'Live', mobileLabel: 'Live on marketplace', cell: (r) => count(r.live) },
  { key: 'month', header: 'This month', cell: (r) => count(r.onboarded_this_month) },
  { key: 'week', header: 'Last 7 days', cell: (r) => count(r.onboarded_7d) },
  { key: 'pending', header: 'Waiting', mobileLabel: 'Applications waiting', cell: (r) => count(r.pending_applications) },
  { key: 'last', header: 'Last onboarded', cell: (r) => <LastOnboarded at={r.last_onboarded_at} /> },
]

export default function Employees() {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: adminKeys.employees, queryFn: listEmployeeReferrals })
  const [adding, setAdding] = React.useState<{ code?: string } | null>(null)

  const rows = query.data ?? []
  const employees = rows.filter((r) => r.employee_id).map((r, i) => ({ ...r, rank: i + 1 }))
  const unassigned = rows.filter((r) => !r.employee_id)
  const activeCount = employees.filter((r) => r.active).length

  const unassignedColumns: Column<EmployeeReferralRow>[] = [
    { key: 'code', header: 'Code', cell: (r) => <span className="font-mono text-sm tracking-wide">{r.referral_code}</span> },
    { key: 'onboarded', header: 'Onboarded', className: 'font-semibold', cell: (r) => count(r.onboarded) },
    { key: 'pending', header: 'Waiting', mobileLabel: 'Applications waiting', cell: (r) => count(r.pending_applications) },
    { key: 'last', header: 'Last onboarded', cell: (r) => <LastOnboarded at={r.last_onboarded_at} /> },
    {
      key: 'assign',
      header: <span className="sr-only">Assign</span>,
      className: 'text-right',
      cell: (r) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            setAdding({ code: r.referral_code })
          }}
        >
          <UserPlus /> Give to an employee
        </Button>
      ),
    },
  ]

  return (
    <>
      <Seo title="Employees" noindex />
      <PageHeader
        eyebrow="Accounts"
        title="Employees"
        description="Who on the team brought each creator in, counted by the referral code creators type when they sign up."
        actions={
          <Button size="sm" onClick={() => setAdding({})}>
            <Plus /> Add employee
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Employees"
          value={formatNumber(employees.length)}
          icon={<IdCard />}
          loading={query.isPending}
          hint={`${formatNumber(activeCount)} active`}
        />
        <StatsCard
          label="Creators onboarded"
          value={formatNumber(sum(employees, 'onboarded'))}
          icon={<Sparkles />}
          loading={query.isPending}
          hint="With an employee’s code"
        />
        <StatsCard
          label="This month"
          value={formatNumber(sum(employees, 'onboarded_this_month'))}
          icon={<CalendarDays />}
          loading={query.isPending}
          hint="Onboarded since the 1st"
        />
        <StatsCard
          label="Waiting for review"
          value={formatNumber(sum(employees, 'pending_applications'))}
          icon={<Clock />}
          loading={query.isPending}
          hint="Applications with an employee’s code"
        />
      </div>

      <DataTable
        columns={employeeColumns}
        rows={query.data ? employees : undefined}
        rowKey={(r) => r.employee_id!}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        onRowClick={(r) => navigate(`/admin/employees/${r.employee_id}`)}
        mobilePrimary="employee"
        empty={
          <EmptyState
            icon={<IdCard />}
            title="No employees yet"
            description="Add the people who hand out referral codes, and every creator who signs up with their code is counted here."
            action={
              <Button size="sm" onClick={() => setAdding({})}>
                <Plus /> Add employee
              </Button>
            }
          />
        }
      />

      {unassigned.length > 0 && (
        <section className="mt-10">
          <SectionTitle
            title="Codes without an employee"
            description="Codes creators typed that no employee owns yet — a typo, or a code handed out before it was added here. Give one to an employee and its creators count for them."
          />
          <DataTable
            columns={unassignedColumns}
            rows={unassigned}
            rowKey={(r) => r.referral_code}
            onRowClick={(r) => navigate(`/admin/creators?q=${encodeURIComponent(r.referral_code)}`)}
            mobilePrimary="code"
          />
        </section>
      )}

      <EmployeeDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} code={adding?.code} />
    </>
  )
}
