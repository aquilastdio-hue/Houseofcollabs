/**
 * Rule-based natural-language → marketplace filter parser.
 *
 * Shared by the `smart-search` Edge Function (Deno) and the web client (as an
 * offline fallback). It must stay dependency-free so both runtimes can import
 * it. An AI parser can implement the same `SmartSearchParser` interface later.
 *
 *   "female beauty creator in Delhi under 5000 within 5 days"
 *   → { category: 'beauty', gender: 'female', city: 'Delhi', maxPrice: 5000, maxDelivery: 5 }
 */

export type SmartSearchFilters = {
  q?: string
  category?: string
  city?: string
  state?: string
  gender?: 'female' | 'male' | 'non_binary'
  minPrice?: number
  maxPrice?: number
  maxDelivery?: number
  minFollowers?: number
  maxFollowers?: number
  minAge?: number
  maxAge?: number
  languages?: string[]
  creatorType?: string
  contentType?: string
  platform?: string
  verified?: boolean
  available?: boolean
  minRating?: number
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'followers' | 'delivery' | 'rating' | 'newest'
}

export type SmartSearchChip = { field: keyof SmartSearchFilters; label: string }

export type SmartSearchResult = {
  query: string
  filters: SmartSearchFilters
  chips: SmartSearchChip[]
  source: 'rules' | 'ai'
}

export interface SmartSearchParser {
  parse(query: string): Promise<SmartSearchResult> | SmartSearchResult
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  beauty: ['beauty', 'makeup', 'make-up', 'make up', 'cosmetics', 'cosmetic', 'mua', 'lipstick', 'glam'],
  fashion: ['fashion', 'style', 'styling', 'stylist', 'outfit', 'outfits', 'clothing', 'apparel', 'ootd', 'streetwear', 'ethnic wear', 'saree'],
  fitness: ['fitness', 'gym', 'workout', 'yoga', 'athlete', 'sports', 'sport', 'running', 'crossfit'],
  lifestyle: ['lifestyle', 'vlog', 'vlogs', 'vlogger', 'home decor', 'wellness', 'daily life'],
  food: ['food', 'foodie', 'foodies', 'recipe', 'recipes', 'cooking', 'chef', 'baking', 'baker', 'restaurant', 'cafe', 'snacks'],
  travel: ['travel', 'traveller', 'travellers', 'traveler', 'travelers', 'trip', 'trips', 'hotel', 'hotels', 'staycation', 'tourism'],
  technology: ['tech', 'technology', 'gadget', 'gadgets', 'smartphone', 'smartphones', 'electronics', 'laptop', 'laptops', 'apps'],
  gaming: ['gaming', 'gamer', 'gamers', 'esports', 'e-sports', 'streamer', 'streamers', 'games'],
  parenting: ['parenting', 'parent', 'parents', 'mom', 'moms', 'mommy', 'mother', 'mothers', 'dad', 'dads', 'father', 'baby', 'babies', 'kids', 'family'],
  education: ['education', 'educational', 'edtech', 'study', 'studies', 'teacher', 'tutor', 'learning', 'career', 'exam'],
  skincare: ['skincare', 'skin care', 'skin', 'serum', 'sunscreen', 'derm', 'dermatology'],
  couple: ['couple', 'couples', 'relationship', 'husband wife', 'married couple'],
  photography: ['photography', 'photographer', 'photographers', 'photoshoot', 'photo shoot', 'product photography', 'flatlay', 'flat lay'],
  finance: ['finance', 'financial', 'money', 'investing', 'investment', 'stock market', 'stocks', 'fintech', 'personal finance', 'crypto'],
  ugc: [],
}

const CATEGORY_LABELS: Record<string, string> = {
  beauty: 'Beauty', fashion: 'Fashion', fitness: 'Fitness', lifestyle: 'Lifestyle', food: 'Food', travel: 'Travel',
  technology: 'Technology', gaming: 'Gaming', parenting: 'Parenting', education: 'Education', skincare: 'Skincare',
  couple: 'Couple', ugc: 'UGC', photography: 'Photography', finance: 'Finance',
}

/** alias → canonical city name */
export const CITY_ALIASES: Record<string, string> = {
  'new delhi': 'Delhi', delhi: 'Delhi', 'delhi ncr': 'Delhi', ncr: 'Delhi',
  mumbai: 'Mumbai', bombay: 'Mumbai', 'navi mumbai': 'Navi Mumbai', thane: 'Thane',
  bengaluru: 'Bengaluru', bangalore: 'Bengaluru', blr: 'Bengaluru',
  hyderabad: 'Hyderabad', secunderabad: 'Hyderabad',
  chennai: 'Chennai', madras: 'Chennai',
  kolkata: 'Kolkata', calcutta: 'Kolkata',
  pune: 'Pune', ahmedabad: 'Ahmedabad', surat: 'Surat', vadodara: 'Vadodara', baroda: 'Vadodara',
  jaipur: 'Jaipur', udaipur: 'Udaipur', jodhpur: 'Jodhpur', lucknow: 'Lucknow', kanpur: 'Kanpur', noida: 'Noida',
  gurugram: 'Gurugram', gurgaon: 'Gurugram', faridabad: 'Faridabad', ghaziabad: 'Ghaziabad', chandigarh: 'Chandigarh',
  indore: 'Indore', bhopal: 'Bhopal', nagpur: 'Nagpur', nashik: 'Nashik', kochi: 'Kochi', cochin: 'Kochi',
  thiruvananthapuram: 'Thiruvananthapuram', trivandrum: 'Thiruvananthapuram', kozhikode: 'Kozhikode', calicut: 'Kozhikode',
  coimbatore: 'Coimbatore', madurai: 'Madurai', mysuru: 'Mysuru', mysore: 'Mysuru', mangaluru: 'Mangaluru', mangalore: 'Mangaluru',
  visakhapatnam: 'Visakhapatnam', vizag: 'Visakhapatnam', vijayawada: 'Vijayawada', bhubaneswar: 'Bhubaneswar',
  patna: 'Patna', ranchi: 'Ranchi', guwahati: 'Guwahati', shillong: 'Shillong', dehradun: 'Dehradun', amritsar: 'Amritsar',
  ludhiana: 'Ludhiana', srinagar: 'Srinagar', panaji: 'Goa', goa: 'Goa', pondicherry: 'Puducherry', puducherry: 'Puducherry',
  varanasi: 'Varanasi', agra: 'Agra', raipur: 'Raipur', rishikesh: 'Rishikesh',
}

export const STATES = [
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'gujarat', 'haryana', 'himachal pradesh',
  'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
  'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh', 'uttarakhand',
  'west bengal', 'jammu and kashmir', 'ladakh',
]

const LANGUAGE_ALIASES: Record<string, string> = {
  english: 'English', hindi: 'Hindi', hinglish: 'Hinglish', tamil: 'Tamil', telugu: 'Telugu', malayalam: 'Malayalam',
  kannada: 'Kannada', bengali: 'Bengali', bangla: 'Bengali', marathi: 'Marathi', gujarati: 'Gujarati', punjabi: 'Punjabi',
  odia: 'Odia', oriya: 'Odia', urdu: 'Urdu', assamese: 'Assamese', konkani: 'Konkani',
}

const PLATFORM_ALIASES: Record<string, string> = {
  instagram: 'instagram', insta: 'instagram', ig: 'instagram',
  youtube: 'youtube', youtuber: 'youtube', youtubers: 'youtube', yt: 'youtube',
  threads: 'threads',
  twitter: 'x', tweets: 'x', tweet: 'x',
  facebook: 'facebook', fb: 'facebook',
}

/**
 * A bare “x” is too common to alias directly — “3 x reels” would read as a
 * platform — so it only counts when the phrasing makes it one.
 */
const X_PLATFORM_RE = /\b(?:on|from|via|for)\s+x\b|\bx\s+(?:creators?|influencers?|accounts?|users?)\b|\bx\.com\b/

const CONTENT_ALIASES: [RegExp, string, string][] = [
  [/\bugc (?:videos?|ads?|content)\b/, 'ugc_video', 'UGC video'],
  [/\b(?:youtube|yt) (?:videos?|integrations?)\b/, 'youtube_video', 'YouTube video'],
  [/\b(?:yt |youtube )?shorts?\b/, 'short', 'Shorts'],
  [/\breels?\b/, 'reel', 'Reels'],
  [/\bstor(?:y|ies)\b/, 'story', 'Stories'],
  [/\bunboxings?\b/, 'unboxing', 'Unboxing'],
  [/\b(?:product )?review(?:s|ers?)?\b/, 'review', 'Reviews'],
  [/\b(?:tutorials?|how[\s-]?tos?)\b/, 'tutorial', 'Tutorials'],
  [/\b(?:live[\s-]?streams?|live sessions?|going live)\b/, 'live', 'Live'],
  [/\b(?:feed )?posts?\b/, 'post', 'Posts'],
]

const CREATOR_TYPES: [RegExp, string, string][] = [
  [/\bugc creators?\b/, 'ugc_creator', 'UGC creator'],
  [/\bnano(?:[\s-]?(?:influencers?|creators?))?\b/, 'nano_creator', 'Nano creator'],
  [/\bmicro(?:[\s-]?(?:influencers?|creators?))?\b/, 'micro_creator', 'Micro creator'],
  [/\b(?:macro|mega|celebrity|big)[\s-]?(?:influencers?|creators?)\b/, 'influencer', 'Influencer'],
  [/\b(?:professional|pro|studio)[\s-]?(?:creators?|photographers?)\b/, 'professional_creator', 'Professional creator'],
]

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'at', 'from', 'with', 'who', 'that', 'which', 'is', 'are',
  'me', 'i', 'we', 'my', 'our', 'need', 'needs', 'want', 'wanted', 'looking', 'find', 'show', 'get', 'hire', 'some', 'any',
  'creator', 'creators', 'influencer', 'influencers', 'content', 'someone', 'people', 'person', 'based', 'near', 'around',
  'can', 'do', 'does', 'make', 'makes', 'making', 'video', 'videos', 'rs', 'price', 'budget', 'cost', 'costing', 'please',
  'best', 'good', 'great', 'top', 'within', 'under', 'below', 'above', 'over', 'less', 'more', 'than', 'up', 'upto',
  'india', 'indian', 'speaking', 'speaks', 'language', 'languages', 'days', 'day', 'delivery', 'budget-friendly', 'like',
  'category', 'niche', 'profile', 'profiles', 'account', 'accounts', 'only', 'also', 'just', 'now',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const AMOUNT = String.raw`(\d+(?:[.,]\d+)*\s*(?:k|l|lakh|lakhs|lac|lacs|m|mn|million)?)`

/** "5k" → 5000, "1.5 lakh" → 150000, "12,000" → 12000 */
export function parseAmount(raw: string): number | undefined {
  const m = raw.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)*)\s*(k|l|lakh|lakhs|lac|lacs|m|mn|million)?$/)
  if (!m) return undefined
  const num = Number(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(num)) return undefined
  const unit = m[2] ?? ''
  const mult = unit === 'k' ? 1_000 : ['l', 'lakh', 'lakhs', 'lac', 'lacs'].includes(unit) ? 100_000 : ['m', 'mn', 'million'].includes(unit) ? 1_000_000 : 1
  return Math.round(num * mult)
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}

function compactNum(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`
  return String(n)
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
export function parseSmartQuery(input: string): SmartSearchResult {
  const query = (input ?? '').slice(0, 300)
  const filters: SmartSearchFilters = {}
  const chips: SmartSearchChip[] = []
  let text = ` ${query.toLowerCase()} `
    .replace(/₹/g, ' rs ')
    .replace(/\b(?:inr|rupees?|rs\.)/g, ' rs ')
    .replace(/(\d)\s+(k|lakh|lakhs|lac|lacs)\b/g, '$1$2')
    .replace(/[“”"!?;]/g, ' ')
    .replace(/\s+/g, ' ')

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re)
    if (!m) return false
    const accepted = fn(m)
    if (accepted === false) return false
    text = text.replace(m[0], ' ')
    return true
  }

  // --- Delivery ------------------------------------------------------------
  take(/\b(?:within|in|under|less than|max(?:imum)?|up ?to)\s+(\d{1,2})\s*(?:days?|d)\b/, (m) => {
    filters.maxDelivery = Number(m[1])
  }) ||
    take(/\b(\d{1,2})[\s-]*days?\s+(?:delivery|turnaround|tat)\b/, (m) => {
      filters.maxDelivery = Number(m[1])
    }) ||
    take(/\b(?:24\s*(?:hours?|hrs?|h)|same[\s-]?day|overnight|express|urgent(?:ly)?|asap)(?:\s+delivery)?\b/, () => {
      filters.maxDelivery = 1
    }) ||
    take(/\b(?:within (?:a|one) week|this week|in a week)\b/, () => {
      filters.maxDelivery = 7
    }) ||
    take(/\bfast(?:est)? (?:delivery|turnaround)\b/, () => {
      filters.maxDelivery = 3
    })

  // --- Followers -----------------------------------------------------------
  take(new RegExp(String.raw`\bbetween\s+${AMOUNT}\s*(?:-|to|and)\s*${AMOUNT}\s*(?:followers|subscribers|subs|fans)\b`), (m) => {
    filters.minFollowers = parseAmount(m[1]!)
    filters.maxFollowers = parseAmount(m[2]!)
  }) ||
    take(new RegExp(String.raw`\b${AMOUNT}\s*(?:-|to)\s*${AMOUNT}\s*(?:followers|subscribers|subs|fans)\b`), (m) => {
      filters.minFollowers = parseAmount(m[1]!)
      filters.maxFollowers = parseAmount(m[2]!)
    }) ||
    take(new RegExp(String.raw`\b(under|below|less than|fewer than|max(?:imum)?|up ?to)\s+${AMOUNT}\s*(?:followers|subscribers|subs|fans)\b`), (m) => {
      filters.maxFollowers = parseAmount(m[2]!)
    }) ||
    take(new RegExp(String.raw`\b(?:(?:over|above|more than|at ?least|min(?:imum)?)\s+)?${AMOUNT}\s*\+?\s*(?:followers|subscribers|subs|fans|audience)\b`), (m) => {
      filters.minFollowers = parseAmount(m[1]!)
    })

  // --- Age -----------------------------------------------------------------
  take(/\b(?:aged?\s+)?(\d{2})\s*(?:-|to)\s*(\d{2})\s*(?:years?|yrs?)(?:\s*old)?\b/, (m) => {
    filters.minAge = Number(m[1])
    filters.maxAge = Number(m[2])
  }) ||
    take(/\b(?:age|aged)\s+(\d{2})\s*(?:-|to)\s*(\d{2})\b/, (m) => {
      filters.minAge = Number(m[1])
      filters.maxAge = Number(m[2])
    }) ||
    take(/\b(?:under|below|younger than)\s+(\d{2})\s*(?:years?|yrs?)(?:\s*old)?\b/, (m) => {
      filters.maxAge = Number(m[1])
    }) ||
    take(/\b(?:over|above|older than)\s+(\d{2})\s*(?:years?|yrs?)(?:\s*old)?\b/, (m) => {
      filters.minAge = Number(m[1])
    }) ||
    take(/\b(?:in (?:their|her|his) )?([1-6])0s\b/, (m) => {
      filters.minAge = Number(m[1]) * 10
      filters.maxAge = Number(m[1]) * 10 + 9
    })

  // --- Price ---------------------------------------------------------------
  const price = (raw: string) => {
    const n = parseAmount(raw)
    return n !== undefined && n >= 100 ? n : undefined
  }
  take(new RegExp(String.raw`\b(?:between|from)?\s*(?:rs\s*)?${AMOUNT}\s*(?:-|to|and)\s*(?:rs\s*)?${AMOUNT}(?:\s*rs)?\b`), (m) => {
    const a = price(m[1]!)
    const b = price(m[2]!)
    if (a === undefined || b === undefined || b < a) return false
    filters.minPrice = a
    filters.maxPrice = b
  })
  if (filters.maxPrice === undefined) {
    take(new RegExp(String.raw`\b(?:under|below|less than|up ?to|max(?:imum)?|within|budget(?: of)?|cheaper than|not more than|no more than)\s+(?:rs\s*)?${AMOUNT}(?:\s*rs)?\b`), (m) => {
      const v = price(m[1]!)
      if (v === undefined) return false
      filters.maxPrice = v
    })
  }
  if (filters.minPrice === undefined) {
    take(new RegExp(String.raw`\b(?:above|over|more than|min(?:imum)?|at ?least|starting (?:at|from))\s+(?:rs\s*)?${AMOUNT}(?:\s*rs)?\b`), (m) => {
      const v = price(m[1]!)
      if (v === undefined) return false
      filters.minPrice = v
    })
  }
  if (filters.maxPrice === undefined && filters.minPrice === undefined) {
    take(new RegExp(String.raw`\brs\s*${AMOUNT}\b|\b${AMOUNT}\s*rs\b`), (m) => {
      const v = price((m[1] ?? m[2])!)
      if (v === undefined) return false
      filters.maxPrice = v
    })
  }

  // --- Rating + sort intent -----------------------------------------------
  take(/\b(\d(?:\.\d)?)\s*\+?\s*(?:stars?|star rating|rating|rated)\b/, (m) => {
    const r = Number(m[1])
    if (r < 1 || r > 5) return false
    filters.minRating = r
  })
  take(/\b(?:top|highly|best)[\s-]rated\b/, () => {
    filters.minRating = filters.minRating ?? 4.5
    filters.sort = 'rating'
  })
  take(/\b(?:cheapest|affordable|budget[\s-]friendly|low[\s-]cost|inexpensive)\b/, () => {
    filters.sort = filters.sort ?? 'price_asc'
  })
  take(/\b(?:most followers|biggest|most popular|popular)\b/, () => {
    filters.sort = filters.sort ?? 'followers'
  })
  take(/\b(?:fastest|quickest)\b/, () => {
    filters.sort = filters.sort ?? 'delivery'
  })
  take(/\b(?:newest|latest|new(?!\s+delhi))\b/, () => {
    filters.sort = filters.sort ?? 'newest'
  })

  // --- Flags ---------------------------------------------------------------
  take(/\b(?:verified|blue tick)\b/, () => {
    filters.verified = true
  })
  take(/\b(?:available|available now|free now)\b/, () => {
    filters.available = true
  })

  // --- Creator type (before categories: "ugc creator") --------------------
  for (const [re, value] of CREATOR_TYPES) {
    if (take(re, () => void (filters.creatorType = value))) break
  }

  // --- Content type & platform --------------------------------------------
  for (const [re, value] of CONTENT_ALIASES) {
    if (take(re, () => void (filters.contentType = value))) break
  }
  if (!take(X_PLATFORM_RE, () => void (filters.platform = 'x'))) {
    for (const [alias, value] of Object.entries(PLATFORM_ALIASES)) {
      if (take(new RegExp(String.raw`\b${escapeRegExp(alias)}\b`), () => void (filters.platform = value))) break
    }
  }

  // --- Gender (female before male; "women" before "men") ------------------
  take(/\b(?:females?|wom[ae]n|girls?|lad(?:y|ies)|she)\b/, () => {
    filters.gender = 'female'
  }) ||
    take(/\b(?:males?|men|man|guys?|boys?|he)\b/, () => {
      filters.gender = 'male'
    }) ||
    take(/\b(?:non[\s-]?binary|enby|queer)\b/, () => {
      filters.gender = 'non_binary'
    })

  // --- Languages ------------------------------------------------------------
  const languages: string[] = []
  for (const [alias, value] of Object.entries(LANGUAGE_ALIASES)) {
    const re = new RegExp(String.raw`\b${alias}(?:[\s-]speaking)?\b`)
    if (re.test(text) && !languages.includes(value)) {
      languages.push(value)
      text = text.replace(re, ' ')
    }
  }
  if (languages.length) filters.languages = languages

  // --- Location (longest aliases first) -------------------------------------
  const cityAliases = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length)
  for (const alias of cityAliases) {
    const re = new RegExp(String.raw`\b(?:in|from|based in|near|around)?\s*${escapeRegExp(alias)}\b`)
    if (re.test(text)) {
      filters.city = CITY_ALIASES[alias]
      text = text.replace(re, ' ')
      break
    }
  }
  if (!filters.city) {
    for (const state of [...STATES].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(String.raw`\b(?:in|from|based in)?\s*${escapeRegExp(state)}\b`)
      if (re.test(text)) {
        filters.state = titleCase(state)
        text = text.replace(re, ' ')
        break
      }
    }
  }

  // --- Category (multi-word synonyms first) ---------------------------------
  const synonyms = Object.entries(CATEGORY_SYNONYMS)
    .flatMap(([slug, words]) => words.map((w) => [slug, w] as const))
    .sort((a, b) => b[1].length - a[1].length)
  for (const [slug, word] of synonyms) {
    const re = new RegExp(String.raw`\b${escapeRegExp(word)}\b`)
    if (re.test(text)) {
      filters.category = slug
      text = text.replace(re, ' ')
      break
    }
  }
  if (/\bugc\b/.test(text)) {
    if (!filters.category) filters.category = 'ugc'
    else if (!filters.contentType) filters.contentType = 'ugc_video'
    text = text.replace(/\bugc\b/g, ' ')
  }

  // --- Leftover keywords → free-text query -----------------------------------
  const leftover = text
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .join(' ')
    .trim()
  if (leftover) filters.q = leftover

  // --- Human readable interpretation ----------------------------------------
  if (filters.category) chips.push({ field: 'category', label: CATEGORY_LABELS[filters.category] ?? titleCase(filters.category) })
  if (filters.gender) chips.push({ field: 'gender', label: filters.gender === 'non_binary' ? 'Non-binary' : titleCase(filters.gender) })
  if (filters.city) chips.push({ field: 'city', label: filters.city })
  if (filters.state) chips.push({ field: 'state', label: filters.state })
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined) chips.push({ field: 'maxPrice', label: `${inr(filters.minPrice)}–${inr(filters.maxPrice)}` })
  else if (filters.maxPrice !== undefined) chips.push({ field: 'maxPrice', label: `Under ${inr(filters.maxPrice)}` })
  else if (filters.minPrice !== undefined) chips.push({ field: 'minPrice', label: `From ${inr(filters.minPrice)}` })
  if (filters.maxDelivery !== undefined) chips.push({ field: 'maxDelivery', label: filters.maxDelivery <= 1 ? '24h delivery' : `≤ ${filters.maxDelivery} days` })
  if (filters.minFollowers !== undefined || filters.maxFollowers !== undefined) {
    const lo = filters.minFollowers !== undefined ? compactNum(filters.minFollowers) : null
    const hi = filters.maxFollowers !== undefined ? compactNum(filters.maxFollowers) : null
    chips.push({ field: 'minFollowers', label: lo && hi ? `${lo}–${hi} followers` : lo ? `${lo}+ followers` : `Under ${hi} followers` })
  }
  if (filters.minAge !== undefined || filters.maxAge !== undefined) {
    chips.push({ field: 'minAge', label: `Age ${filters.minAge ?? 16}–${filters.maxAge ?? 60}` })
  }
  if (filters.languages) chips.push({ field: 'languages', label: filters.languages.join(', ') })
  if (filters.creatorType) chips.push({ field: 'creatorType', label: CREATOR_TYPES.find((c) => c[1] === filters.creatorType)?.[2] ?? filters.creatorType })
  if (filters.contentType) chips.push({ field: 'contentType', label: CONTENT_ALIASES.find((c) => c[1] === filters.contentType)?.[2] ?? filters.contentType })
  if (filters.platform) chips.push({ field: 'platform', label: titleCase(filters.platform) })
  if (filters.verified) chips.push({ field: 'verified', label: 'Verified' })
  if (filters.available) chips.push({ field: 'available', label: 'Available now' })
  if (filters.minRating !== undefined) chips.push({ field: 'minRating', label: `${filters.minRating}+ stars` })
  if (filters.q) chips.push({ field: 'q', label: `“${filters.q}”` })

  return { query, filters, chips, source: 'rules' }
}

export const ruleBasedParser: SmartSearchParser = { parse: parseSmartQuery }
