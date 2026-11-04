import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUrlState } from '@/components/admin/use-url-state'
import { BillingOverview } from '@/components/admin/billing-overview'
import { BillingInvoices, BillingTaxes } from '@/components/admin/billing-books'
import { BillingSetup } from '@/components/admin/billing-setup'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'settings', label: 'Settings' },
] as const

/**
 * Admin → Billing & tax (migration 0038): revenue kept apart from creator
 * money and from taxes, every document issued, what is owed to the
 * government, and the rates and business details the documents use.
 */
export default function AdminBilling() {
  const url = useUrlState()
  const tab = TABS.some((t) => t.value === url.get('tab')) ? url.get('tab') : 'overview'
  return (
    <>
      <Seo title="Billing & tax" noindex />
      <PageHeader
        title="Billing & tax"
        description="HOC revenue, GST, TDS and TCS kept apart from creators’ money, with every invoice, statement and deposit."
      />
      <Tabs value={tab} onValueChange={(v) => url.update({ tab: v === 'overview' ? null : v, kind: null, status: null, q: null, test: null })}>
        <TabsList className="no-scrollbar mb-6 max-w-full overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <BillingOverview />
        </TabsContent>
        <TabsContent value="invoices">
          <BillingInvoices />
        </TabsContent>
        <TabsContent value="taxes">
          <BillingTaxes />
        </TabsContent>
        <TabsContent value="settings">
          <BillingSetup />
        </TabsContent>
      </Tabs>
    </>
  )
}
