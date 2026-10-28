import { Link, useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Package, Volume2 } from 'lucide-react'
import { fetchAllPages } from '@/lib/fetch-all'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatRelative } from '@/lib/format'
import { listOrders, type AdminBrandDetail } from '@/services/admin.service'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { ACCOUNT_STATUS_META, StatusBadge } from './admin-status'
import { DetailCard, DetailItem, DetailList, ExternalAnchor, IdText } from './detail'
import { orderColumns } from './order-table'
import { ordersHref } from './order-presets'

export function BrandIdentity({ brand: b }: { brand: AdminBrandDetail }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <Avatar src={b.brand_logo_url} name={b.brand_name} size="xl" shape="rounded" />
      <div className="min-w-0">
        <h1 className="font-display text-display-sm font-semibold sm:text-display-md">{b.brand_name}</h1>
        <p className="mt-0.5 truncate text-sm text-muted">{[b.industry, b.location].filter(Boolean).join(' · ') || `@${b.brand_slug}`}</p>
        <div className="mt-2">{b.profile && <StatusBadge meta={ACCOUNT_STATUS_META} value={b.profile.status} />}</div>
      </div>
    </div>
  )
}

export function BrandDetailsCard({ brand: b }: { brand: AdminBrandDetail }) {
  const prefs = (b as any).preferences as Record<string, unknown> | null
  
  return (
    <DetailCard title="Brand profile" description="What creators see when they work with this brand.">
      {b.brand_logo_url && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium text-faint">Brand logo</p>
          <img src={b.brand_logo_url} alt={`${b.brand_name} logo`} className="h-16 w-auto rounded border border-line" />
        </div>
      )}
      {b.description && <p className="mb-6 max-w-prose text-sm leading-relaxed whitespace-pre-line text-ink-soft">{b.description}</p>}
      <DetailList>
        <DetailItem label="Industry">{b.industry}</DetailItem>
        <DetailItem label="Location">{b.location}</DetailItem>
        <DetailItem label="Website">{b.website_url ? <ExternalAnchor href={b.website_url}>{b.website_url.replace(/^https?:\/\//, '')}</ExternalAnchor> : null}</DetailItem>
        <DetailItem label="Instagram">{b.instagram_url ? <ExternalAnchor href={b.instagram_url}>{b.instagram_url.replace(/^https?:\/\/(www\.)?/, '')}</ExternalAnchor> : null}</DetailItem>
        <DetailItem label="Pronunciation" className="sm:col-span-2">
          {b.brand_pronunciation || b.pronunciation_audio_url ? (
            <span className="flex flex-col gap-2">
              {b.brand_pronunciation && <span>“{b.brand_pronunciation}”</span>}
              {b.pronunciation_audio_url && (
                <span className="flex items-center gap-2">
                  <Volume2 className="size-4 shrink-0 text-muted" aria-hidden />
                  <audio controls preload="none" src={b.pronunciation_audio_url} className="h-9 w-full max-w-sm" aria-label={`How to pronounce ${b.brand_name}`} />
                </span>
              )}
            </span>
          ) : null}
        </DetailItem>
        <DetailItem label="Contact person">{prefs?.contact_person ? String(prefs.contact_person) : null}</DetailItem>
        <DetailItem label="Designation">{prefs?.designation ? String(prefs.designation) : null}</DetailItem>
        <DetailItem label="Contact email">
          {b.contact_email ? (
            <a href={`mailto:${b.contact_email}`} className="focus-ring rounded-sm underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
              {b.contact_email}
            </a>
          ) : null}
        </DetailItem>
        <DetailItem label="Contact phone">{b.contact_phone ? <a href={`tel:${b.contact_phone.replace(/[^+\d]/g, '')}`} className="focus-ring rounded-sm hover:underline">{b.contact_phone}</a> : null}</DetailItem>
        <DetailItem label="WhatsApp">{prefs?.whatsapp ? String(prefs.whatsapp) : null}</DetailItem>
        <DetailItem label="LinkedIn">{prefs?.linkedin_url ? <ExternalAnchor href={String(prefs.linkedin_url)}>{String(prefs.linkedin_url).replace(/^https?:\/\/(www\.)?/, '')}</ExternalAnchor> : null}</DetailItem>
        <DetailItem label="Slug" mono>
          {b.brand_slug}
        </DetailItem>
        <DetailItem label="Profile updated">{formatDateTime(b.updated_at)}</DetailItem>
      </DetailList>
    </DetailCard>
  )
}

/**
 * Login identity behind the brand. Suspending lives in the "Account access"
 * card (AccountActionsPanel), which also blocks sign-in at Supabase Auth.
 */
export function BrandAccountCard({ brand: b }: { brand: AdminBrandDetail }) {
  const p = b.profile
  const status = p?.status ?? 'active'

  return (
    <DetailCard title="Account" description="Login identity behind this brand.">
      <DetailList className="sm:grid-cols-1">
        <DetailItem label="Login email">
          {p?.email ? (
            <a href={`mailto:${p.email}`} className="focus-ring rounded-sm underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
              {p.email}
            </a>
          ) : null}
        </DetailItem>
        <DetailItem label="Account holder">{p?.full_name}</DetailItem>
        <DetailItem label="Phone">{p?.phone}</DetailItem>
        <DetailItem label="Status">
          <StatusBadge meta={ACCOUNT_STATUS_META} value={status} size="sm" />
        </DetailItem>
        <DetailItem label="Last seen">{p?.last_seen_at ? <span title={formatDateTime(p.last_seen_at)}>{formatRelative(p.last_seen_at)}</span> : 'Never'}</DetailItem>
        <DetailItem label="Joined">{formatDate(b.created_at)}</DetailItem>
        <DetailItem label="Brand id">
          <IdText value={b.id} />
        </DetailItem>
      </DetailList>
    </DetailCard>
  )
}

export function BrandPreferencesCard({ brand: b }: { brand: AdminBrandDetail }) {
  const prefs = (b as any).preferences as Record<string, unknown> | null
  const creatorCategories = prefs?.creator_categories as string[] | null
  const collaborationTypes = prefs?.collaboration_types as string[] | null
  const creatorLocation = prefs?.creator_location as string | null
  const specificCities = prefs?.specific_cities as string[] | null
  const budgetRange = prefs?.budget_range as string | null
  
  const budgetLabels: Record<string, string> = {
    under_25k: 'Under ₹25K',
    '25k_50k': '₹25K – ₹50K',
    '50k_100k': '₹50K – ₹1L',
    '100k_500k': '₹1L – ₹5L',
    over_500k: '₹5L+',
  }
  
  const locationLabels: Record<string, string> = {
    pan_india: 'Pan India',
    specific: 'Specific cities',
  }
  
  return (
    <DetailCard title="Preferences" description="What the brand is looking for in creators, from onboarding.">
      <DetailList>
        <DetailItem label="Creator categories" className="sm:col-span-2">
          {creatorCategories && creatorCategories.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {creatorCategories.map((cat) => (
                <span key={cat} className="rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium">
                  {cat}
                </span>
              ))}
            </span>
          ) : null}
        </DetailItem>
        <DetailItem label="Collaboration types" className="sm:col-span-2">
          {collaborationTypes && collaborationTypes.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {collaborationTypes.map((type) => (
                <span key={type} className="rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium">
                  {type}
                </span>
              ))}
            </span>
          ) : null}
        </DetailItem>
        <DetailItem label="Creator location preference">
          {creatorLocation ? locationLabels[creatorLocation] || creatorLocation : null}
        </DetailItem>
        <DetailItem label="Specific cities" className="sm:col-span-2">
          {creatorLocation === 'specific' && specificCities && specificCities.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {specificCities.map((city) => (
                <span key={city} className="rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium">
                  {city}
                </span>
              ))}
            </span>
          ) : null}
        </DetailItem>
        <DetailItem label="Budget range">
          {budgetRange ? budgetLabels[budgetRange] || budgetRange : null}
        </DetailItem>
      </DetailList>
    </DetailCard>
  )
}

/** Every order placed by the brand, newest first, linking into the admin order view. */
export function BrandRecentOrders({ brandId }: { brandId: string }) {
  const navigate = useNavigate()
  const params = { brandId }
  const query = useQuery({
    queryKey: qk.admin.orders(params),
    queryFn: () => fetchAllPages((page, pageSize) => listOrders({ ...params, page, pageSize })),
    placeholderData: keepPreviousData,
  })

  return (
    <DetailCard
      title="Orders"
      description={query.data ? `${query.data.total} order${query.data.total === 1 ? '' : 's'} placed, newest first.` : 'Orders placed by this brand.'}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to={ordersHref({ brand: brandId })}>View all in Orders</Link>
        </Button>
      }
    >
      <DataTable
        columns={orderColumns(['number', 'creator', 'service', 'amount', 'payment', 'status', 'created'])}
        rows={query.data?.items}
        rowKey={(o) => o.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
        mobilePrimary="number"
        empty={<EmptyState compact icon={<Package />} title="No orders yet" description="This brand hasn’t checked out with any creator." />}
      />
    </DetailCard>
  )
}
