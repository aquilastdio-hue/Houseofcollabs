import * as React from 'react'
import { ExternalLink, FileText, Image as ImageIcon, Video } from 'lucide-react'
import { formatINR, formatNumber } from '@/lib/format'
import { applicationFileUrl, type ApplicationRow } from '@/services/applications.service'
import { Button } from '@/components/ui/button'

/**
 * The whole submission, as the applicant filled it in.
 *
 * Most of a multi-page form lands in `applications.profile` rather than in
 * columns — the table only has columns for the handful of fields the admin list
 * and provisioning need. Reading straight from that jsonb keeps this screen in
 * step with the forms: a question added to page 3 shows up here without a
 * migration. It also means nothing is silently dropped, which is what happened
 * when this dialog only rendered the columns.
 */

type Json = Record<string, unknown>

const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v))
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

const LABELS: Record<string, string> = {
  ugc_video: 'UGC video',
  // Retired from the form. Kept here because this panel lists the figures an
  // applicant actually submitted, and older applications still carry the key.
  extra_usage: 'Extra 30-day usage',
  collab_reel: 'Collaborative reel',
  static_carousel: 'Static / carousel post',
  story: 'Instagram story',
  youtube_integration: 'YouTube integration',
  within_city: 'Within city',
  within_country: 'Within country',
  out_of_country: 'Out of country',
  pan_india: 'Pan India',
  specific: 'Specific cities',
  yes: 'Yes',
  selectively: 'Selectively',
  no: 'No',
}
const label = (key: string) => LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

function Line({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-muted">{text}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean)
  if (items.length === 0) return null
  return (
    <section className="border-t border-line pt-4">
      <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h4>
      <dl className="mt-1 divide-y divide-line">{items}</dl>
    </section>
  )
}

function Link_({ href, children }: { href: string; children?: React.ReactNode }) {
  const external = /^https?:\/\//i.test(href)
  return (
    <a
      href={external ? href : `https://${href}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {children ?? href}
    </a>
  )
}

/**
 * Anything uploaded lives in the private `applications` bucket, so it can only
 * be opened through a short-lived signed URL — there is no public URL to link.
 */
export function FileLink({ path, label: text, kind = 'file' }: { path: string; label: string; kind?: 'video' | 'image' | 'file' }) {
  const [busy, setBusy] = React.useState(false)
  const Icon = kind === 'video' ? Video : kind === 'image' ? ImageIcon : FileText
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const url = await applicationFileUrl(path)
          if (url) window.open(url, '_blank', 'noopener,noreferrer')
        } finally {
          setBusy(false)
        }
      }}
    >
      <Icon /> {text} <ExternalLink className="size-3.5" />
    </Button>
  )
}

function Files({ paths, label: text, kind }: { paths: string[]; label: string; kind: 'video' | 'image' }) {
  if (paths.length === 0) return null
  return (
    <Line label={text}>
      <div className="flex flex-wrap gap-2">
        {paths.map((p, i) => (
          <FileLink key={p} path={p} kind={kind} label={paths.length > 1 ? `${text.replace(/s$/, '')} ${i + 1}` : `Open ${text.toLowerCase()}`} />
        ))}
      </div>
    </Line>
  )
}

const rupees = (v: unknown) => {
  const n = Number(str(v))
  return str(v) && Number.isFinite(n) ? formatINR(n) : null
}

// ---------------------------------------------------------------------------
// Creator — the five-page sign-up
// ---------------------------------------------------------------------------
function CreatorSubmission({ row }: { row: ApplicationRow }) {
  const p = obj(row.profile)
  const ig = obj(p.instagram)
  const yt = obj(p.youtube)
  const rates = obj(p.rates)
  const videos = list(p.videos)
  const photos = list(p.photos)
  const offered = Object.entries(rates).filter(([, v]) => str(v))

  return (
    <>
      <Section title="Basic details">
        {str(p.creator_name) && <Line label="Creator name">{str(p.creator_name)}</Line>}
        {str(p.whatsapp) && <Line label="WhatsApp">{str(p.whatsapp)}</Line>}
      </Section>

      <Section title="Social profile">
        {str(ig.handle) && (
          <Line label="Instagram">
            {str(ig.handle)}
            {str(ig.url) ? <> · <Link_ href={str(ig.url)}>profile</Link_></> : null}
          </Line>
        )}
        {str(ig.followers) && <Line label="Followers">{formatNumber(Number(str(ig.followers)))}</Line>}
        {str(yt.url) && (
          <Line label="YouTube">
            <Link_ href={str(yt.url)} />
            {str(yt.subscribers) ? ` · ${formatNumber(Number(str(yt.subscribers)))} subscribers` : ''}
          </Line>
        )}
      </Section>

      <Section title="Content">
        <Files paths={videos} label="Videos" kind="video" />
        <Files paths={photos} label="Photos" kind="image" />
      </Section>

      <Section title="Commercials">
        {offered.length > 0 && (
          <Line label="Offers">
            <ul className="space-y-0.5">
              {offered.map(([key, value]) => (
                <li key={key}>
                  {label(key)} — <span className="font-medium">{rupees(value) ?? str(value)}</span>
                </li>
              ))}
            </ul>
          </Line>
        )}
        {p.barter_available === true && <Line label="Barter">{label(str(p.barter_stance) || 'yes')}</Line>}
        {p.barter_available === false && offered.length > 0 && <Line label="Barter">No</Line>}
        {str(p.travel_scope) && <Line label="Open to travel">{label(str(p.travel_scope))}</Line>}
      </Section>

      <Section title="Go live">
        {list(p.open_to).length > 0 && <Line label="Open to">{list(p.open_to).join(', ')}</Line>}
        {p.confirmed === true && <Line label="Declaration">Confirmed their details and content are authentic</Line>}
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Brand — the three-page sign-up
// ---------------------------------------------------------------------------
function BrandSubmission({ row }: { row: ApplicationRow }) {
  const p = obj(row.profile)
  const v = obj(p.verification)
  const cities = list(p.specific_cities)

  return (
    <>
      <Section title="Brand details">
        {str(p.industry) && <Line label="Industry">{str(p.industry)}</Line>}
        {str(p.website_or_handle) && (
          <Line label="Website / handle">
            {/^https?:\/\/|\./i.test(str(p.website_or_handle)) ? <Link_ href={str(p.website_or_handle)} /> : str(p.website_or_handle)}
          </Line>
        )}
        {str(p.contact_person) && (
          <Line label="Contact person">
            {str(p.contact_person)}
            {str(p.designation) ? ` · ${str(p.designation)}` : ''}
          </Line>
        )}
        {row.image_path && (
          <Line label="Brand logo">
            <FileLink path={row.image_path} kind="image" label="Open logo" />
          </Line>
        )}
      </Section>

      <Section title="What they need">
        {row.categories?.length ? <Line label="Creator categories">{row.categories.join(', ')}</Line> : null}
        {list(p.collaboration_types).length > 0 && <Line label="Collaboration type">{list(p.collaboration_types).join(', ')}</Line>}
        {str(p.creator_location) && (
          <Line label="Creator location">
            {label(str(p.creator_location))}
            {cities.length ? ` · ${cities.join(', ')}` : ''}
          </Line>
        )}
      </Section>

      <Section title="Verification">
        {str(v.company_website) && <Line label="Company website"><Link_ href={str(v.company_website)} /></Line>}
        {str(v.instagram_url) && <Line label="Instagram">{str(v.instagram_url)}</Line>}
        {str(v.linkedin_url) && <Line label="LinkedIn"><Link_ href={str(v.linkedin_url)} /></Line>}
        {str(v.registration_doc_path) && (
          <Line label={str(v.registration_doc_type) || 'Registration document'}>
            <FileLink path={str(v.registration_doc_path)} label="Open document" />
          </Line>
        )}
        {str(v.representative_id_path) && (
          <Line label="Representative ID">
            <FileLink path={str(v.representative_id_path)} label="Open ID" />
          </Line>
        )}
        {v.authorized === true && <Line label="Declaration">Confirmed they are authorized to represent this brand</Line>}
      </Section>
    </>
  )
}

export function ApplicationSubmission({ row }: { row: ApplicationRow }) {
  return row.role === 'creator' ? <CreatorSubmission row={row} /> : <BrandSubmission row={row} />
}
