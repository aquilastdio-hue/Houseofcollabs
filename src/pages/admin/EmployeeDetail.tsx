import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, IdCard, Pencil, Sparkles, Store, Trash2, UserX } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { fetchAllPages } from '@/lib/fetch-all'
import { formatNumber } from '@/lib/format'
import { deleteEmployee, listCreators, listEmployeeReferrals } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DetailCard, DetailPageSkeleton } from '@/components/admin/detail'
import { adminKeys } from '@/components/admin/admin-keys'
import { creatorColumns } from '@/components/admin/creator-table'
import { EmployeeDialog } from '@/components/admin/employee-dialog'
import { useAdminMutation } from '@/components/admin/use-admin-mutation'

/**
 * The creators whose profile carries `code`. The creators search also matches
 * names, emails and longer codes that contain it, so only exact matches stay —
 * the same upper-cased, trimmed comparison `admin_employee_referrals` counts.
 */
async function creatorsWithCode(code: string) {
  const { items } = await fetchAllPages((page, pageSize) => listCreators({ search: code, page, pageSize }))
  return items.filter((c) => c.referral_code?.trim().toUpperCase() === code)
}

export default function EmployeeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)

  const query = useQuery({ queryKey: adminKeys.employees, queryFn: listEmployeeReferrals })
  const employee = query.data?.find((r) => r.employee_id === id)
  const code = employee?.referral_code ?? ''
  const creators = useQuery({
    queryKey: qk.admin.creators({ referralCode: code }),
    queryFn: () => creatorsWithCode(code),
    enabled: !!code,
  })

  const remove = useAdminMutation(() => deleteEmployee(id), {
    invalidate: [adminKeys.employees],
    success: () => `${employee?.full_name ?? 'Employee'} removed`,
    onSuccess: () => navigate('/admin/employees'),
  })

  if (query.isPending) {
    return (
      <>
        <Seo title="Employee" noindex />
        <DetailPageSkeleton />
      </>
    )
  }
  if (query.isError) {
    return (
      <>
        <Seo title="Employee" noindex />
        <Breadcrumb items={[{ label: 'Employees', href: '/admin/employees' }, { label: 'Employee' }]} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  }
  if (!employee) {
    return (
      <>
        <Seo title="Employee not found" noindex />
        <Breadcrumb items={[{ label: 'Employees', href: '/admin/employees' }, { label: 'Not found' }]} />
        <EmptyState
          icon={<UserX />}
          title="Employee not found"
          description="This employee doesn’t exist or was removed."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin/employees">Back to employees</Link>
            </Button>
          }
        />
      </>
    )
  }

  const name = employee.full_name ?? code

  return (
    <>
      <Seo title={`${name} · Employees`} noindex />
      <Breadcrumb items={[{ label: 'Employees', href: '/admin/employees' }, { label: name }]} />

      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-display-sm font-semibold sm:text-display-md">
            {name}
            {!employee.active && <Badge tone="neutral">Inactive</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Code <span className="font-mono font-medium tracking-wide text-ink">{code}</span>
            {employee.phone && (
              <>
                {' · '}
                <a href={`tel:${employee.phone.replace(/[^+\d]/g, '')}`} className="focus-ring rounded-sm hover:underline">
                  {employee.phone}
                </a>
              </>
            )}
            {employee.email && (
              <>
                {' · '}
                <a href={`mailto:${employee.email}`} className="focus-ring rounded-sm hover:underline">
                  {employee.email}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRemoving(true)}>
            <Trash2 /> Remove
          </Button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Creators onboarded" value={formatNumber(Number(employee.onboarded))} icon={<Sparkles />} hint="Signed up with this code" />
        <StatsCard label="Live on marketplace" value={formatNumber(Number(employee.live))} icon={<Store />} hint="Published storefronts" />
        <StatsCard
          label="This month"
          value={formatNumber(Number(employee.onboarded_this_month))}
          icon={<CalendarDays />}
          hint={`${formatNumber(Number(employee.onboarded_7d))} in the last 7 days`}
        />
        <StatsCard
          label="Waiting for review"
          value={formatNumber(Number(employee.pending_applications))}
          icon={<Clock />}
          hint={
            Number(employee.pending_applications) > 0 ? (
              <Link to={`/admin/applications?q=${encodeURIComponent(code)}`} className="underline underline-offset-2 hover:text-ink">
                Open in Applications
              </Link>
            ) : (
              'Applications with this code'
            )
          }
        />
      </div>

      <DetailCard
        title="Creators onboarded"
        description={creators.data ? `${formatNumber(creators.data.length)} creator${creators.data.length === 1 ? '' : 's'} with code ${code}, newest first.` : `Creators with code ${code}.`}
      >
        <DataTable
          columns={creatorColumns}
          rows={creators.data}
          rowKey={(c) => c.id}
          loading={creators.isPending}
          error={creators.isError ? creators.error : undefined}
          onRetry={() => void creators.refetch()}
          onRowClick={(c) => navigate(`/admin/creators/${c.id}`)}
          mobilePrimary="name"
          empty={<EmptyState compact icon={<IdCard />} title="No creators yet" description={`Creators who type ${code} on the sign-up form show up here once they’re approved.`} />}
        />
      </DetailCard>

      <EmployeeDialog open={editing} onOpenChange={setEditing} employee={employee} />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Remove ${name}?`}
        description={`Their creators keep code ${code}; it moves to “Codes without an employee” until someone else has it. To keep their numbers on the list instead, edit them and switch off Active.`}
        confirmLabel="Remove employee"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
