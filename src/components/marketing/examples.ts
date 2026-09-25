import type { CreatorService, ServiceAddon } from '@/types'

/**
 * ILLUSTRATIVE EXAMPLES ONLY. These objects feed real components (e.g.
 * `ServiceCard`) on marketing pages to explain what a storefront contains.
 * Every place that renders them labels them as an example; they are never
 * presented as real creators, real prices or real orders.
 */
export type ExampleService = Pick<
  CreatorService,
  'id' | 'title' | 'description' | 'price' | 'delivery_days' | 'revisions_included' | 'includes' | 'content_type' | 'requires_shipping' | 'active'
>
export type ExampleAddon = Pick<ServiceAddon, 'id' | 'name' | 'price' | 'active' | 'description'>

export const EXAMPLE_UGC_SERVICE: ExampleService = {
  id: 'example-ugc-video',
  title: '30-second UGC video',
  description: null,
  price: 3500,
  delivery_days: 5,
  revisions_included: 2,
  includes: ['Hook and script ideas', 'Vertical 9:16 edit with captions', 'One product-in-hand shot list'],
  content_type: 'ugc_video',
  requires_shipping: true,
  active: true,
}

export const EXAMPLE_UGC_ADDONS: ExampleAddon[] = [
  { id: 'example-raw', name: 'Raw footage', price: 800, active: true, description: null },
  { id: 'example-express', name: 'Faster delivery (48 hours)', price: 1200, active: true, description: null },
  { id: 'example-usage', name: 'Paid ads usage · 3 months', price: 2500, active: true, description: null },
]

export const EXAMPLE_REEL_SERVICE: ExampleService = {
  id: 'example-reel',
  title: 'Instagram reel with voiceover',
  description: 'A styled reel for your launch, shot and edited in my own voice for my audience.',
  price: 6000,
  delivery_days: 7,
  revisions_included: 1,
  includes: ['Concept call on chat', 'Posted on my profile with collab tag', 'Story mention on launch day'],
  content_type: 'reel',
  requires_shipping: true,
  active: true,
}

export const EXAMPLE_REEL_ADDONS: ExampleAddon[] = [
  { id: 'example-extra-rev', name: 'Extra revision', price: 700, active: true, description: null },
  { id: 'example-raw-reel', name: 'Raw footage', price: 1000, active: true, description: null },
]
