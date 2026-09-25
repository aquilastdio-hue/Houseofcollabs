# Frontend conventions

Read this before adding or changing any page. It describes the design system,
the data layer and the rules every screen follows.

## Stack

React 19 · TypeScript 5.9 (strict) · Vite 7 · Tailwind CSS 4 · React Router 7 ·
TanStack Query 5 · React Hook Form + Zod 4 · Radix primitives (`radix-ui`) ·
Lucide icons (`lucide-react` 0.577) · Recharts 3 · Sonner toasts · supabase-js 2.

Path aliases: `@/…` → `src/…`, `@shared/…` → `supabase/functions/_shared/…`.

## Design tokens (src/styles/index.css)

The default Tailwind colour palette is **removed**. Only these colours exist:

| Purpose | Utilities |
| --- | --- |
| Page / surfaces | `bg-canvas` (page), `bg-surface` (cards, white), `bg-subtle`, `bg-muted-surface` |
| Lines | `border-line`, `border-line-strong` |
| Text | `text-ink` (primary), `text-ink-soft`, `text-muted` (secondary), `text-faint` (placeholder/meta) |
| Dark sections | `bg-night`, `bg-night-soft`, `border-night-line`, `text-white` |
| Accent (limelight) | `bg-lime`, `bg-lime-strong`, `bg-lime-soft`, `text-lime-ink` (text on lime-soft) |
| Tints | `bg-{rose,peach,sand,mint,sky,lilac}-soft` + `text-{rose,peach,sand,mint,sky,lilac}` |
| Semantic | `success`, `warning`, `danger`, `info` (+ `-soft` backgrounds) |
| Basics | `white`, `black`, `transparent`, `current` |

Opacity modifiers work (`bg-ink/10`, `bg-night/40`). Never use hex values or
`gray-500`-style classes — they don't exist and render nothing.

* Fonts: `font-sans` (Geist, default), `font-display` (Bricolage Grotesque —
  headings, numbers), `font-serif` (Instrument Serif — use *italic* accent words
  in hero headlines, e.g. `<span className="font-serif italic font-normal">`).
* Display sizes: `text-display-2xl | xl | lg | md | sm` (fluid). `eyebrow`
  utility for small uppercase labels.
* Radius: `rounded-control` (inputs), `rounded-card`, `rounded-panel`,
  `rounded-hero`, `rounded-pill`.
* Shadows: `shadow-card`, `shadow-card-hover`, `shadow-float`, `shadow-glow`.
* Motion: `ease-spring`, `ease-soft`, `animate-fade-up`, `animate-fade-in`,
  `animate-scale-in`, `animate-marquee`, `animate-float`.
* Layout: `container-page` (max width + responsive gutters), `py-section`
  (fluid section spacing), `max-w-page`, `max-w-prose`, `bg-grain` texture,
  `mask-fade-x`, `no-scrollbar`, `focus-ring`.
* Breakpoints: Tailwind defaults + `3xl` (1792px). Design for 375 → 1920.

## Components

`src/components/ui` (primitives): `Button` (variants primary · accent · secondary
· outline · ghost · subtle · inverse · ghost-inverse · danger · danger-ghost ·
link; sizes xs · sm · md · lg · xl · icon · icon-sm · icon-xs; `loading`,
`asChild`, `block`), `Input` (`leftIcon`, `rightSlot`, `inputSize`), `Textarea`,
`Label`, `Field` (label + hint + error, wires aria), `Badge` (tones), `Card*`,
`Avatar`, `Skeleton`, `Spinner`/`PageLoader`, `Separator`, `Dialog*`/`Modal`,
`Drawer`/`DrawerContent`, `Tabs*`, `DropdownMenu*`, `Popover*`, `Tooltip`,
`Select` (high-level) / `SelectRoot…`, `Checkbox`/`CheckboxRow`,
`Switch`/`SwitchRow`, `RadioGroup`/`RadioGroupItem`/`RadioCard`, `Slider`,
`Progress`, `Accordion*`, `Command*`, `Combobox`, `MultiSelect`, `DatePicker`,
`Toaster` (use `toast` from `sonner`).

`src/components/shared`: `EmptyState`, `ErrorState`, `AsyncBoundary`,
`ConfirmDialog` (optional required reason), `PageHeader`, `SectionTitle`,
`StatsCard`, `Pagination`, `DataTable` (responsive table ↔ cards),
`Breadcrumb`, `Stepper`, `StarRating`/`RatingLabel`/`StarInput`, `ReviewCard`,
`FAQ`, `Seo`, `Logo`/`LogoMark`, `SmartImage`, `FileUploader`,
`ImageUploader`, `AudioRecorder`, `RangeSlider`, `ChartCard`/`AreaTrend`/`Bars`.

Domain: `marketplace/CreatorCard`, `CreatorCardSkeleton`, `CreatorGrid`,
`SaveButton` (wishlists); `creator/ServiceCard`, `creator/PortfolioGrid`,
`MediaTile`; `orders/OrderStatusBadge`, `orders/OrderCard`;
`notifications/NotificationBell`, `NotificationItem`.

## Data layer

* **Only `src/services/*` talk to Supabase.** Pages use services through
  TanStack Query (`useQuery`/`useMutation`) or the hooks in `src/hooks`.
* Query keys live in `src/lib/query-keys.ts` (`qk`). Mutations must
  invalidate the keys they affect.
* Errors: services throw `AppError` (user-safe `message`). The global mutation
  cache shows a toast automatically; set `meta: { silent: true }` to handle it
  yourself, or `meta: { successMessage: '…' }` for a success toast.
* Auth: `useAuth()` → `{ session, user, profile, role, brand, creator, isAdmin,
  refresh, signOut }`. `creator` is the full `CreatorProfile` (with categories,
  languages, socials, services+addons, portfolio). Call `refresh()` after
  changing the brand/creator/profile records.
* Money is formatted with `formatINR`; counts with `formatCompact`/`formatNumber`;
  dates with `formatDate`/`formatRelative` (`src/lib/format.ts`).
* Order status labels/tones/hints: `src/lib/order-state.ts`.
* Constants/options: `src/lib/constants.ts`.
* Types: `src/types/index.ts` (+ generated `database.types.ts`).
* Storage uploads: use the service helpers (they validate + optimise).
  Private files are shown via signed URLs (`useSignedUrls`).

## Rules for every screen

1. **Real data only.** Everything comes from Supabase via services. No mock
   arrays, no fake numbers, no lorem ipsum. Marketing copy on public pages is
   fine (and must be original).
2. **Four states** for every async view: loading (`Skeleton`/`PageLoader`),
   error (`ErrorState` with retry), empty (`EmptyState` with a next action),
   content.
3. **Forms**: React Hook Form + Zod (`zodResolver`), `Field` for every input,
   inline validation messages, disabled/loading submit, toast on success.
   Validation mirrors the database constraints (lengths, ranges, formats).
4. **Accessibility**: semantic landmarks/headings (one `h1` per page), labels
   for every control, `aria-label` on icon-only buttons, keyboard reachable,
   visible focus (`focus-ring`), alt text on meaningful images.
5. **Responsive**: works at 375px, 768px, 1024px, 1280px, 1440px, 1920px.
   Filters become drawers on mobile; tables become cards (`DataTable`).
6. **SEO**: every public page renders `<Seo title description />`. App pages
   render `<Seo title noindex />`.
7. **No TODOs, no placeholders, no "coming soon".**
8. Security is enforced by the database; the UI just hides actions a user
   can't take. Never compute prices/fees/statuses on the client for real
   writes — call the RPCs.
9. Match the surrounding code style (2 spaces, single quotes, no semicolons).

## Verification

* `npx tsc -b` must pass. `npx vite build` must pass.
* `npm test` runs unit tests (Vitest).
