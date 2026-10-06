// Generates supabase/seed.sql — deterministic, realistic demo data.
//
// Orders are created by driving the real workflow functions as each user
// (create_order → confirm_order_payment → accept → ship → deliver → revise →
// approve → review → payouts), so history, notifications, earnings and audit
// logs are internally consistent. Timelines are then backdated so analytics
// charts look realistic.
//
//   node scripts/generate-seed.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(root, 'supabase', 'seed.sql')
// No password is written into the seed. Every demo account gets an unknowable
// random one, so a clone of this repo never carries a working credential — the
// previous shared literal ended up published in a public repo *and* in use on
// production. Give yourself a local login after reseeding; the README has the
// one-liner.
const RANDOM_PASSWORD_SQL = "extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))"

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260919)
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const id = (prefix, n) => `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const tarr = (a) => (a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`)
const uarr = (a) => (a.length ? `array[${a.map(q).join(', ')}]::uuid[]` : `'{}'::uuid[]`)
const jsonb = (o) => `${q(JSON.stringify(o))}::jsonb`
const round100 = (n) => Math.max(500, Math.round(n / 100) * 100)
const out = []
const emit = (s) => out.push(s)

// ---------------------------------------------------------------------------
// reference data (fictional)
// ---------------------------------------------------------------------------
const brands = [
  { slug: 'kumkum-naturals', name: 'Kumkum Naturals', email: 'kumkum@spotlit.demo', owner: 'Meera Kulkarni', industry: 'Beauty & personal care', location: 'Jaipur', desc: 'Ayurveda-inspired skincare made in small batches with cold-pressed oils and Rajasthani botanicals.', pron: 'KUM-kum na-chu-RALS', phone: '+91 98290 11223' },
  { slug: 'urban-tiffin-co', name: 'Urban Tiffin Co.', email: 'urbantiffin@spotlit.demo', owner: 'Rahul Nair', industry: 'Food & beverage', location: 'Mumbai', desc: 'Homestyle meal boxes delivered hot across Mumbai — dal, sabzi and love, packed daily.', pron: 'UR-ban TIF-in co', phone: '+91 98200 44556' },
  { slug: 'nimbus-audio', name: 'Nimbus Audio', email: 'nimbus@spotlit.demo', owner: 'Priyanka Rao', industry: 'Consumer electronics', location: 'Bengaluru', desc: 'Wireless earbuds and speakers tuned for Indian music and long commutes.', pron: 'NIM-bus AW-dee-oh', phone: '+91 98450 77889' },
  { slug: 'saffron-street', name: 'Saffron Street', email: 'saffron@spotlit.demo', owner: 'Aditi Malhotra', industry: 'Fashion & apparel', location: 'Delhi', desc: 'Contemporary ethnic wear for everyday — breathable cotton kurtas, co-ords and festive sets.', pron: 'SAF-ron street', phone: '+91 98110 22334' },
  { slug: 'peak-protein-labs', name: 'Peak Protein Labs', email: 'peakprotein@spotlit.demo', owner: 'Varun Shetty', industry: 'Health & fitness', location: 'Pune', desc: 'Clean-label whey, plant protein and electrolytes — third-party tested, no fillers.', pron: 'peek PRO-teen labs', phone: '+91 98220 55667' },
  { slug: 'chai-circle', name: 'Chai Circle', email: 'chaicircle@spotlit.demo', owner: 'Sayani Ghosh', industry: 'Food & beverage', location: 'Kolkata', desc: 'Single-estate Darjeeling and Assam chai blends with small-batch snacks.', pron: 'chai SUR-kul', phone: '+91 98300 88990' },
  { slug: 'loom-and-lace', name: 'Loom & Lace', email: 'loomlace@spotlit.demo', owner: 'Hetal Shah', industry: 'Fashion & apparel', location: 'Surat', desc: 'Handloom sarees, stoles and dupattas woven with artisan clusters across Gujarat.', pron: 'loom and lace', phone: '+91 98250 12121' },
  { slug: 'byte-gadgets', name: 'Byte Gadgets', email: 'bytegadgets@spotlit.demo', owner: 'Faizal Ahmed', industry: 'Consumer electronics', location: 'Hyderabad', desc: 'Smart plugs, lights and home gadgets that just work with your phone.', pron: 'bite GAD-jets', phone: '+91 98490 34343' },
  { slug: 'wander-bags', name: 'Wander Bags', email: 'wanderbags@spotlit.demo', owner: 'Nikhil DSouza', industry: 'Travel & hospitality', location: 'Goa', desc: 'Travel backpacks and organisers designed for Indian trains, flights and road trips.', pron: 'WAN-der bags', phone: '+91 98220 56565' },
  { slug: 'little-sprouts', name: 'Little Sprouts', email: 'littlesprouts@spotlit.demo', owner: 'Kavitha Raman', industry: 'Parenting & kids', location: 'Chennai', desc: 'Organic baby care, gentle bath products and wooden toys for little ones.', pron: 'LIT-ul sprouts', phone: '+91 98410 78787' },
]

// [name, gender, age, city, state, languages, [primary, secondary], type, socials, headline, bio]
const creatorRows = [
  ['Aanya Kapoor', 'female', 26, 'Delhi', 'Delhi', ['Hindi', 'English'], ['beauty', 'skincare'], 'micro_creator', { instagram: 48200, youtube: 12400 }, 'Everyday makeup that survives Delhi summers', 'I make honest, no-filter makeup and skincare videos for real Indian skin. My audience trusts me for long-wear tests, dupes and routines that fit a busy morning. I love working with homegrown brands.'],
  ['Rhea Menon', 'female', 29, 'Kochi', 'Kerala', ['Malayalam', 'English', 'Hindi'], ['skincare', 'beauty'], 'micro_creator', { instagram: 36100 }, 'Skincare that respects humid weather', 'Certified skincare nerd from Kochi. I break down ingredients, test textures on camera and build simple routines for humid climates. Expect calm, clean visuals and clear explanations.'],
  ['Kabir Sethi', 'male', 31, 'Mumbai', 'Maharashtra', ['Hindi', 'English'], ['technology', 'ugc'], 'influencer', { youtube: 212000, instagram: 64300 }, 'Gadgets explained in 60 seconds', 'I review phones, audio and smart-home tech with a focus on what actually matters for Indian buyers. Crisp unboxings, honest pros and cons, and studio-quality audio.'],
  ['Ishita Rao', 'female', 24, 'Bengaluru', 'Karnataka', ['English', 'Kannada', 'Hindi'], ['fashion', 'lifestyle'], 'micro_creator', { instagram: 82400 }, 'Outfit ideas you can actually wear to work', 'Bengaluru-based stylist and creator. I style everyday, sustainable and festive looks with easy transitions and flat lays. My community loves try-on hauls and capsule wardrobes.'],
  ['Arjun Nair', 'male', 27, 'Chennai', 'Tamil Nadu', ['Tamil', 'English'], ['fitness', 'food'], 'micro_creator', { instagram: 57300, youtube: 20100 }, 'Home workouts and high-protein South Indian food', 'Strength coach turned creator. I share no-equipment workouts, meal-prep ideas and supplement reviews without the bro-science. Clean, energetic edits.'],
  ['Meher Gill', 'female', 25, 'Chandigarh', 'Punjab', ['Punjabi', 'Hindi', 'English'], ['fashion', 'couple'], 'nano_creator', { instagram: 9100 }, 'Punjabi wedding-season fashion on a budget', 'Small but mighty community of 9K who love wedding-guest looks, jutti styling and budget festive fits. Warm, high-engagement content.'],
  ['Dev & Tara', 'prefer_not_to_say', 30, 'Pune', 'Maharashtra', ['Hindi', 'Marathi', 'English'], ['couple', 'travel'], 'influencer', { instagram: 121000, youtube: 18200 }, 'A couple who turns weekends into mini adventures', 'We’re Dev and Tara — road trips, cosy stays, gifting ideas and relatable couple moments. Our audience books what we recommend.'],
  ['Sana Qureshi', 'female', 30, 'Hyderabad', 'Telangana', ['Urdu', 'Hindi', 'Telugu', 'English'], ['food', 'lifestyle'], 'micro_creator', { instagram: 44600, youtube: 18300 }, 'Hyderabadi recipes, done in under 20 minutes', 'Home cook sharing quick Hyderabadi and fusion recipes, kitchen hacks and honest taste tests. Warm narration and top-down cooking shots.'],
  ['Vikram Joshi', 'male', 34, 'Ahmedabad', 'Gujarat', ['Gujarati', 'Hindi', 'English'], ['finance', 'education'], 'influencer', { youtube: 382000 }, 'Personal finance in plain Gujarati and Hindi', 'Chartered accountant simplifying money — SIPs, tax-saving and budgeting for first-time earners. Trusted, compliance-aware explainers.'],
  ['Nisha Pillai', 'female', 28, 'Mumbai', 'Maharashtra', ['Hindi', 'English', 'Malayalam'], ['parenting', 'lifestyle'], 'micro_creator', { instagram: 51700 }, 'Toddler-mom life without the perfect filter', 'Mom of a three-year-old sharing honest product reviews, routines and parenting hacks. My audience is young parents in metros.'],
  ['Rohan Das', 'male', 23, 'Kolkata', 'West Bengal', ['Bengali', 'Hindi', 'English'], ['gaming', 'technology'], 'micro_creator', { youtube: 76200 }, 'Mobile gaming, setups and budget gear', 'Streamer and reviewer focused on mobile esports, controllers and budget setups. Fast-paced, meme-friendly edits.'],
  ['Priya Sharma', 'female', 27, 'Jaipur', 'Rajasthan', ['Hindi', 'English'], ['ugc', 'beauty'], 'ugc_creator', { instagram: 3100 }, 'Scroll-stopping UGC ads for D2C brands', 'Full-time UGC creator. I script, shoot and edit ad-ready videos with strong hooks for Meta and YouTube ads. 150+ ads delivered.'],
  ['Aditya Kulkarni', 'male', 32, 'Pune', 'Maharashtra', ['Marathi', 'English', 'Hindi'], ['photography', 'travel'], 'professional_creator', { instagram: 28400 }, 'Product and travel photography with a cinematic eye', 'Commercial photographer with a studio in Pune. Product shoots, flat lays and lifestyle sets with fast turnarounds.'],
  ['Zoya Khan', 'female', 22, 'Lucknow', 'Uttar Pradesh', ['Hindi', 'Urdu', 'English'], ['fashion', 'beauty'], 'nano_creator', { instagram: 7500 }, 'Lucknowi chikankari styling and soft glam', 'College student and creator styling chikankari, modest fashion and soft-glam looks. Very engaged Gen-Z audience.'],
  ['Karthik Reddy', 'male', 29, 'Hyderabad', 'Telangana', ['Telugu', 'English', 'Hindi'], ['technology', 'education'], 'micro_creator', { youtube: 95400 }, 'Apps and AI tools for students and freelancers', 'Software engineer reviewing productivity apps, AI tools and study tech in Telugu and English.'],
  ['Ananya Bose', 'female', 26, 'Kolkata', 'West Bengal', ['Bengali', 'English', 'Hindi'], ['food', 'travel'], 'micro_creator', { instagram: 31300 }, 'Kolkata cafés and weekend food trails', 'Food and café reviewer covering Kolkata and weekend getaways. Honest, cosy, aesthetic reels.'],
  ['Siddharth Iyer', 'male', 35, 'Bengaluru', 'Karnataka', ['English', 'Tamil', 'Kannada'], ['finance', 'technology'], 'influencer', { youtube: 151000, instagram: 40200 }, 'Fintech and investing for young professionals', 'Ex-banker explaining fintech apps, credit cards and investing basics. Clear, trustworthy and well-researched.'],
  ['Tanvi Desai', 'female', 24, 'Surat', 'Gujarat', ['Gujarati', 'Hindi', 'English'], ['ugc', 'lifestyle'], 'ugc_creator', { instagram: 5200 }, 'Relatable UGC for home and lifestyle brands', 'UGC creator making relatable, voiceover-led videos for home, kitchen and lifestyle products. Quick turnarounds.'],
  ['Harsh Vardhan', 'male', 28, 'Gurugram', 'Haryana', ['Hindi', 'English'], ['fitness', 'lifestyle'], 'micro_creator', { instagram: 66500 }, 'Corporate-life fitness that fits a 9-to-6', 'Fitness for working professionals: 20-minute workouts, desk stretches and realistic nutrition.'],
  ['Lavanya Krishnan', 'female', 31, 'Coimbatore', 'Tamil Nadu', ['Tamil', 'English'], ['parenting', 'education'], 'micro_creator', { instagram: 22100 }, 'Montessori-inspired play and learning at home', 'Former teacher sharing learning activities, toy reviews and gentle-parenting tips.'],
  ['Neel Banerjee', 'male', 26, 'Delhi', 'Delhi', ['Hindi', 'English', 'Bengali'], ['gaming'], 'influencer', { youtube: 241000 }, 'PC gaming, builds and high-energy streams', 'PC builds, esports commentary and gear reviews with a loyal, very active community.'],
  ['Kavya Hegde', 'female', 25, 'Mangaluru', 'Karnataka', ['Kannada', 'Konkani', 'English'], ['skincare', 'ugc'], 'nano_creator', { instagram: 8200 }, 'Minimal skincare and clean-beauty UGC', 'Minimal, dewy aesthetics and ingredient-first skincare UGC for coastal climates.'],
  ['Imran Shaikh', 'male', 30, 'Mumbai', 'Maharashtra', ['Hindi', 'Marathi', 'English'], ['photography', 'ugc'], 'professional_creator', { instagram: 18400 }, 'E-commerce product shoots, fast', 'Studio photographer for D2C catalogues — white-background, lifestyle and stop-motion.'],
  ['Riya Malhotra', 'female', 23, 'Noida', 'Uttar Pradesh', ['Hindi', 'English'], ['beauty', 'fashion'], 'micro_creator', { instagram: 73400 }, 'Trendy looks for college and first jobs', 'Beauty and fashion for Gen-Z budgets — dupes, drugstore finds and campus-to-office looks.'],
  ['Manish Yadav', 'male', 27, 'Indore', 'Madhya Pradesh', ['Hindi'], ['food', 'ugc'], 'micro_creator', { instagram: 39200 }, 'Indore street food and snack reviews', 'Street-food explorer and snack reviewer from India’s cleanest city. Loud, fun, very shareable.'],
  ['Pooja Nambiar', 'female', 33, 'Thiruvananthapuram', 'Kerala', ['Malayalam', 'English'], ['lifestyle', 'parenting'], 'micro_creator', { instagram: 27300 }, 'Slow living, Kerala homes and mindful routines', 'Slow-living content — home rituals, sustainable swaps and calm family routines.'],
  ['Aarav Mehta', 'male', 21, 'Mumbai', 'Maharashtra', ['Hindi', 'English'], ['technology', 'gaming'], 'nano_creator', { youtube: 9200, instagram: 6100 }, 'Student tech and budget gaming', 'Engineering student reviewing budget laptops, phones and gaming accessories.'],
  ['Simran Kaur', 'female', 28, 'Amritsar', 'Punjab', ['Punjabi', 'Hindi', 'English'], ['food', 'couple'], 'micro_creator', { instagram: 58100 }, 'Punjabi home food and couple cook-offs', 'Hearty Punjabi recipes and playful couple cook-offs with my husband. High shares and saves.'],
  ['Tenzin Norbu', 'male', 29, 'Gangtok', 'Sikkim', ['English', 'Hindi'], ['travel', 'photography'], 'micro_creator', { instagram: 42300 }, 'Himalayan travel, homestays and slow journeys', 'Travel photographer documenting the Northeast and Himalayas — homestays, treks and gear.'],
  ['Diya Chatterjee', 'female', 26, 'Kolkata', 'West Bengal', ['Bengali', 'English'], ['education', 'ugc'], 'nano_creator', { instagram: 4100 }, 'Study tips and edtech UGC', 'Study-with-me videos, exam tips and UGC for edtech brands.'],
  ['Yash Agarwal', 'male', 25, 'Jaipur', 'Rajasthan', ['Hindi', 'English'], ['finance', 'ugc'], 'micro_creator', { instagram: 31500, youtube: 14200 }, 'Money tips for your first salary', 'Personal finance for first jobbers — budgeting, credit scores and app reviews in Hinglish.'],
  ['Mira Fernandes', 'female', 29, 'Goa', 'Goa', ['English', 'Konkani', 'Hindi'], ['travel', 'lifestyle'], 'micro_creator', { instagram: 61200 }, 'Goa beyond the beaches', 'Hidden Goan cafés, boutique stays, sustainable fashion and slow travel.'],
  // extra: pending review / rejected (not published)
  ['Anushka Patil', 'female', 24, 'Nashik', 'Maharashtra', ['Marathi', 'Hindi', 'English'], ['beauty'], 'nano_creator', { instagram: 6400 }, 'Bridal and festive makeup looks', 'Makeup artist sharing festive and bridal looks for Maharashtrian weddings.', 'pending_review'],
  ['Farhan Ali', 'male', 27, 'Bhopal', 'Madhya Pradesh', ['Hindi', 'Urdu', 'English'], ['fitness'], 'micro_creator', { instagram: 18900 }, 'Calisthenics for beginners', 'Calisthenics coach with beginner-friendly progressions and form checks.', 'pending_review'],
  ['Gauri Joshi', 'female', 22, 'Nagpur', 'Maharashtra', ['Marathi', 'Hindi'], ['fashion'], 'nano_creator', { instagram: 2900 }, 'Thrift flips and budget styling', 'Thrift flips and budget outfit ideas.', 'rejected'],
]

const catNames = {
  beauty: 'Beauty', fashion: 'Fashion', fitness: 'Fitness', lifestyle: 'Lifestyle', food: 'Food', travel: 'Travel',
  technology: 'Technology', gaming: 'Gaming', parenting: 'Parenting', education: 'Education', skincare: 'Skincare',
  couple: 'Couple', ugc: 'UGC', photography: 'Photography', finance: 'Finance',
}

// Service templates per primary category: [title, description, price, days, revisions, content_type, requires_shipping, includes]
const serviceTemplates = {
  beauty: [
    ['UGC makeup tutorial (30–45s)', 'A vertical tutorial using your product in a real routine, with a strong hook and on-screen text.', 2500, 5, 1, 'ugc_video', true, ['1 vertical video', 'Raw footage link', '2 hook options']],
    ['GRWM Instagram Reel', 'A get-ready-with-me reel posted on my Instagram featuring your product naturally.', 6000, 7, 1, 'reel', true, ['1 posted reel', 'Story share', '30-day link in bio']],
    ['Product photos (5 edited)', 'Close-up swatches and lifestyle shots in natural light.', 3500, 4, 1, 'photo', true, ['5 edited photos', 'Commercial use']],
  ],
  skincare: [
    ['Routine reel featuring your product', 'Morning or night routine reel with texture close-ups and honest first impressions.', 4500, 6, 1, 'reel', true, ['1 posted reel', 'Texture close-ups']],
    ['Honest review video (60s)', 'Ingredient breakdown and two-week experience review.', 3000, 10, 1, 'review', true, ['1 review video', 'Raw files']],
    ['Before/after story set', 'Three stories documenting the first week of use.', 1800, 8, 0, 'story', true, ['3 stories', 'Link sticker']],
  ],
  fashion: [
    ['Outfit try-on reel', 'Try-on of 3–4 looks with transitions and styling tips.', 5000, 7, 1, 'reel', true, ['1 posted reel', '3–4 looks']],
    ['Lookbook photos (8 images)', 'Styled lookbook images in outdoor locations.', 4000, 6, 1, 'photo', true, ['8 edited photos', 'Commercial use']],
    ['Styling story set', 'Three stories styling one hero piece three ways.', 1500, 4, 0, 'story', true, ['3 stories']],
  ],
  fitness: [
    ['Workout reel with product', 'A follow-along workout reel with your product featured naturally.', 4000, 5, 1, 'reel', false, ['1 posted reel', 'Pinned comment']],
    ['7-day challenge series', 'Seven daily stories building a habit around your product.', 6500, 10, 1, 'story', true, ['7 stories', 'Highlight for 30 days']],
    ['Supplement review (UGC)', 'Taste, mixability and results review for ads.', 2200, 7, 1, 'ugc_video', true, ['1 UGC video', 'Raw footage']],
  ],
  food: [
    ['Recipe reel using your product', 'A quick recipe reel with top-down shots and voiceover.', 3500, 6, 1, 'reel', true, ['1 posted reel', 'Recipe in caption']],
    ['Restaurant review reel', 'On-location review with food close-ups and honest verdict.', 4500, 5, 1, 'reel', false, ['1 posted reel', 'Location tag']],
    ['Taste test UGC (30s)', 'Unscripted taste-test reaction video for ads.', 1800, 5, 1, 'ugc_video', true, ['1 UGC video', '2 hooks']],
  ],
  travel: [
    ['Stay review reel', 'Cinematic stay review covering rooms, food and experiences.', 8000, 10, 1, 'reel', false, ['1 posted reel', '5 stories', 'Photos']],
    ['Destination guide carousel', 'A saved-worthy 8-slide destination guide.', 5000, 7, 1, 'post', false, ['1 carousel post']],
    ['Travel gear UGC', 'Packing and in-use video for travel products.', 2500, 6, 1, 'ugc_video', true, ['1 UGC video']],
  ],
  technology: [
    ['Unboxing + first impressions (YouTube)', 'A detailed unboxing and first-impressions video on my channel.', 12000, 10, 1, 'unboxing', true, ['1 YouTube video', 'Pinned comment link']],
    ['60s product explainer reel', 'Feature highlights with clean b-roll and captions.', 6000, 7, 1, 'reel', true, ['1 posted reel']],
    ['App walkthrough UGC', 'Screen-recorded walkthrough with face-cam and voiceover.', 3000, 5, 1, 'ugc_video', false, ['1 video', 'Raw files']],
  ],
  gaming: [
    ['Sponsored stream segment', 'A 5-minute segment during a live stream with a code shout-out.', 10000, 7, 0, 'live', false, ['5-min live segment', 'Chat command']],
    ['Gameplay short with integration', 'A YouTube Short with natural brand integration.', 5500, 5, 1, 'short', false, ['1 Short']],
    ['Gear review video', 'Hands-on review of your gaming gear.', 8000, 10, 1, 'review', true, ['1 video', 'Thumbnail']],
  ],
  parenting: [
    ['Honest parent review reel', 'Real-life review with my toddler using your product.', 3500, 8, 1, 'reel', true, ['1 posted reel']],
    ['Day-in-the-life integration', 'Your product woven into a family day-in-the-life reel.', 5000, 8, 1, 'reel', true, ['1 posted reel', '3 stories']],
    ['Product photos with kids (6)', 'Candid lifestyle photos at home.', 4000, 7, 1, 'photo', true, ['6 edited photos']],
  ],
  education: [
    ['Explainer reel', 'A clear explainer reel on your course or app.', 3000, 5, 1, 'reel', false, ['1 posted reel']],
    ['YouTube integration (60–90s)', 'Integrated segment in my next long-form video.', 9000, 12, 1, 'youtube_video', false, ['60–90s integration', 'Link in description']],
    ['Course walkthrough UGC', 'Screen + face-cam walkthrough for ads.', 2500, 5, 1, 'ugc_video', false, ['1 video']],
  ],
  couple: [
    ['Couple gifting reel', 'A playful gifting reel featuring your product.', 6000, 7, 1, 'reel', true, ['1 posted reel', 'Stories']],
    ['Date-night story set', 'Three stories around a date-night theme.', 3000, 5, 0, 'story', true, ['3 stories']],
  ],
  ugc: [
    ['UGC ad video (30s, no posting)', 'Ad-ready vertical video delivered for your ads — not posted on my profile.', 2000, 5, 1, 'ugc_video', true, ['1 video', 'Raw files', '1 revision']],
    ['3 UGC hooks pack', 'Three alternative hooks for split-testing the same video.', 3500, 6, 1, 'ugc_video', true, ['3 hook variations', 'Captions file']],
    ['Voiceover product demo', 'Hands-and-product demo with a warm voiceover.', 2200, 5, 1, 'ugc_video', true, ['1 video', 'Script']],
  ],
  photography: [
    ['Product photoshoot (10 edited)', 'Studio product photography for e-commerce and ads.', 7500, 7, 1, 'photo', true, ['10 edited photos', 'White + lifestyle']],
    ['Flat lay set (6 images)', 'Styled flat lays with props.', 4000, 5, 1, 'photo', true, ['6 edited photos']],
    ['Lifestyle shoot (half day)', 'Half-day lifestyle shoot with a model on location.', 15000, 10, 1, 'photo', true, ['25 edited photos', 'Usage rights 1 year']],
  ],
  finance: [
    ['App review reel', 'Honest walkthrough of your fintech app for first-time users.', 5000, 6, 1, 'reel', false, ['1 posted reel', 'Compliance-reviewed script']],
    ['YouTube explainer integration', 'Explainer segment in a long-form finance video.', 15000, 14, 1, 'youtube_video', false, ['2-min integration', 'Link in description']],
    ['Reel + story combo', 'One reel plus three stories with a swipe-up link.', 4000, 6, 1, 'reel', false, ['1 reel', '3 stories']],
  ],
  lifestyle: [
    ['Morning routine reel', 'A calm morning-routine reel with your product.', 4000, 6, 1, 'reel', true, ['1 posted reel']],
    ['Home styling reel', 'Styling your product into a home corner makeover.', 5500, 8, 1, 'reel', true, ['1 posted reel', 'Photos']],
    ['Story set (3)', 'Three stories with a link sticker.', 1500, 4, 0, 'story', true, ['3 stories']],
  ],
}

const typeFactor = { nano_creator: 0.6, ugc_creator: 0.75, micro_creator: 1, influencer: 2.2, professional_creator: 1.4 }
const addonPresets = [
  { name: 'Extra revision', type: 'extra_revision', price: 400, extra: 1, desc: 'One more round of changes.' },
  { name: '24-hour delivery', type: 'express_delivery', price: 1000, override: 1, desc: 'Delivered within 24 hours of starting.' },
  { name: 'Raw footage', type: 'raw_footage', price: 500, desc: 'All unedited clips via a download link.' },
  { name: 'Extra video', type: 'extra_content', price: 1200, desc: 'An additional cut in a different format.' },
  { name: 'Usage rights (3 months ads)', type: 'usage_rights', price: 1500, desc: 'Run the content as paid ads for 3 months.' },
]

const portfolioTitles = {
  beauty: ['Long-wear lipstick test', 'Soft glam in 60 seconds', 'Kajal smudge test', 'Festive glow look', 'Compact swatches', 'Drugstore dupes'],
  skincare: ['Serum texture close-up', 'Night routine for humid weather', 'SPF white-cast test', 'Barrier repair week', 'Ingredient explainer', 'Toner vs essence'],
  fashion: ['Kurta three ways', 'Workwear capsule', 'Festive co-ord try-on', 'Sneaker styling', 'Monsoon outfits', 'Wedding-guest look'],
  fitness: ['20-minute full body', 'Protein shake review', 'Desk stretches', 'Kettlebell basics', 'Yoga for mornings', 'Meal-prep Sunday'],
  lifestyle: ['Slow morning', 'Coffee corner refresh', 'Plant care routine', 'Weekend reset', 'Desk setup', 'Home ritual'],
  food: ['Hyderabadi biryani shortcut', 'Street-food trail', 'Chai-time snacks', 'Thali taste test', 'Healthy tiffin ideas', 'Café review'],
  travel: ['Himalayan homestay', 'Packing for a train trip', 'Beach café guide', 'Monsoon road trip', 'Boutique stay tour', 'Carry-on essentials'],
  technology: ['Earbuds unboxing', 'Budget phone review', 'Smart plug setup', 'Laptop for students', 'Desk tech tour', 'App walkthrough'],
  gaming: ['Controller review', 'Mobile esports clutch', 'Budget setup tour', 'Headset test', 'Stream highlight', 'PC build timelapse'],
  parenting: ['Bath-time routine', 'Toy review with my toddler', 'Diaper bag essentials', 'Learning through play', 'Snack ideas for kids', 'Bedtime routine'],
  education: ['Study with me', 'Exam planner', 'App for notes', 'Explainer: compound interest', 'Course walkthrough', 'Productivity desk'],
  couple: ['Gifting surprise', 'Couple cook-off', 'Date-night ideas', 'Anniversary trip', 'Matching outfits', 'Weekend plans'],
  ugc: ['Hook test A/B', 'Unboxing UGC', 'Voiceover demo', 'Problem–solution ad', 'Testimonial style', 'Before/after ad'],
  photography: ['Studio product set', 'Flat lay with props', 'Lifestyle shoot', 'Jewellery macro', 'Catalogue whites', 'Golden-hour portraits'],
  finance: ['SIP explained', 'Credit score myths', 'Budgeting app review', 'Tax-saving checklist', 'UPI safety tips', 'First salary plan'],
}

// ---------------------------------------------------------------------------
// entities
// ---------------------------------------------------------------------------
const ADMIN = { id: id('a0000000', 1), email: 'admin@spotlit.demo', name: 'Ops Admin' }
brands.forEach((b, i) => {
  b.userId = id('a1000000', i + 1)
  b.id = id('b1000000', i + 1)
})

const creators = creatorRows.map((r, i) => {
  const [name, gender, age, city, state, languages, cats, type, socials, headline, bio, status = 'published'] = r
  const first = name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')
  const c = {
    idx: i,
    userId: id('a2000000', i + 1),
    id: id('c1000000', i + 1),
    name,
    first: name.split(' ')[0],
    email: `${first}@spotlit.demo`,
    slug: name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    gender,
    age,
    city,
    state,
    languages,
    cats,
    type,
    socials,
    headline,
    bio,
    status,
    avatar: `/demo/avatars/creator-${String(i + 1).padStart(2, '0')}.svg`,
    cover: `/demo/covers/${cats[0]}.svg`,
    verified: status === 'published' && (i % 3 === 0 || type === 'influencer'),
    featured: [0, 2, 3, 6, 8, 11, 16, 31].includes(i),
    responseTime: pick(['within_1_hour', 'within_few_hours', 'within_few_hours', 'within_1_day']),
    engagement: (rand() * 6 + 1.5).toFixed(2),
    services: [],
  }
  // services
  const templates = serviceTemplates[cats[0]]
  const count = status === 'published' ? Math.min(templates.length, i % 4 === 0 ? 3 : 2 + (i % 2)) : 1
  for (let s = 0; s < count; s++) {
    const [title, description, price, days, revisions, contentType, shipping, includes] = templates[s]
    const factor = typeFactor[type] * (0.85 + rand() * 0.35)
    const svc = {
      id: id('d1000000', i * 10 + s + 1),
      title,
      description,
      price: round100(price * factor),
      days: Math.max(2, days + int(-1, 2)),
      revisions,
      contentType,
      shipping,
      includes,
      addons: [],
    }
    const presetIdx = [0, 1, 2, 3, 4].filter(() => rand() > 0.45).slice(0, 3)
    if (presetIdx.length === 0) presetIdx.push(0)
    presetIdx.forEach((p, k) => {
      const a = addonPresets[p]
      if (a.type === 'express_delivery' && svc.days <= 2) return
      svc.addons.push({ id: id('e1000000', i * 100 + s * 10 + k + 1), ...a, price: round100(a.price * (type === 'influencer' ? 1.8 : 1)) })
    })
    c.services.push(svc)
  }
  return c
})
const published = creators.filter((c) => c.status === 'published')
const byFirst = Object.fromEntries(creators.map((c) => [c.first.toLowerCase(), c]))
const byBrand = Object.fromEntries(brands.map((b) => [b.slug, b]))

// ---------------------------------------------------------------------------
// SQL: header + helpers
// ---------------------------------------------------------------------------
emit(`-- =============================================================================
-- Spotlit demo seed — GENERATED by scripts/generate-seed.mjs (do not edit by hand)
-- Demo accounts are created with random, unknowable passwords: a seed file is
-- committed, and a committed password is a published password.
--
-- To sign in locally after reseeding, set one yourself:
--   update auth.users
--   set encrypted_password = extensions.crypt('<your local password>', extensions.gen_salt('bf'))
--   where email = 'admin@spotlit.demo';
-- =============================================================================
begin;

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
end;
$$;

-- seed housekeeping updates are not user actions: keep them out of the audit log
alter table public.profiles disable trigger profiles_audit_changes;
alter table public.creators disable trigger creators_audit_changes;
alter table public.brands disable trigger brands_audit_changes;
`)

// ---------------------------------------------------------------------------
// auth users (+ identities for email login)
// ---------------------------------------------------------------------------
const users = [
  { id: ADMIN.id, email: ADMIN.email, name: ADMIN.name, role: null },
  ...brands.map((b) => ({ id: b.userId, email: b.email, name: b.owner, role: 'brand' })),
  ...creators.map((c) => ({ id: c.userId, email: c.email, name: c.name, role: 'creator' })),
]
emit(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values
${users
  .map(
    (u) =>
      `  ('00000000-0000-0000-0000-000000000000', ${q(u.id)}, 'authenticated', 'authenticated', ${q(u.email)}, ${RANDOM_PASSWORD_SQL}, now(), '{"provider":"email","providers":["email"]}'::jsonb, ${jsonb(u.role ? { full_name: u.name, role: u.role } : { full_name: u.name })}, now(), now(), '', '', '', '')`,
  )
  .join(',\n')};

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now()
from auth.users u where u.email like '%@spotlit.demo';

select private.grant_admin('admin@spotlit.demo');
`)

// ---------------------------------------------------------------------------
// brands
// ---------------------------------------------------------------------------
emit(`insert into public.brands (id, profile_id, brand_name, brand_slug, brand_logo_url, brand_pronunciation, website_url, description, industry, location, contact_email, contact_phone)
values
${brands
  .map(
    (b) =>
      `  (${q(b.id)}, ${q(b.userId)}, ${q(b.name)}, ${q(b.slug)}, ${q(`/demo/brands/${b.slug}.svg`)}, ${q(b.pron)}, ${q(`https://www.${b.slug}.example`)}, ${q(b.desc)}, ${q(b.industry)}, ${q(b.location)}, ${q(b.email.replace('@spotlit.demo', '@brands.example'))}, ${q(b.phone)})`,
  )
  .join(',\n')};
`)

// ---------------------------------------------------------------------------
// creators + storefronts
// ---------------------------------------------------------------------------
emit(`insert into public.creators (id, profile_id, display_name, slug, headline, bio, profile_image_url, cover_image_url, gender, age, city, state, country, creator_type, engagement_rate, verified, available, response_time, status, featured, onboarding_step, rejection_reason, published_at, approved_at)
values
${creators
  .map(
    (c) =>
      `  (${q(c.id)}, ${q(c.userId)}, ${q(c.name)}, ${q(c.slug)}, ${q(c.headline)}, ${q(c.bio)}, ${q(c.avatar)}, ${q(c.cover)}, ${q(c.gender)}, ${c.age}, ${q(c.city)}, ${q(c.state)}, 'India', ${q(c.type)}, ${c.engagement}, ${c.verified}, ${!['Vikram Joshi', 'Yash Agarwal'].includes(c.name)}, ${q(c.responseTime)}, ${q(c.status)}, ${c.featured && c.status === 'published'}, 7, ${c.status === 'rejected' ? q('Please add a clearer profile photo and at least three portfolio pieces.') : 'null'}, ${c.status === 'published' ? 'now()' : 'null'}, ${c.status === 'published' ? 'now()' : 'null'})`,
  )
  .join(',\n')};
`)

emit(`insert into public.creator_categories (creator_id, category_id, is_primary)
${creators
  .flatMap((c) => c.cats.map((slug, k) => `select ${q(c.id)}::uuid, (select id from public.categories where slug = ${q(slug)}), ${k === 0}`))
  .join('\nunion all ')};

insert into public.creator_languages (creator_id, language) values
${creators.flatMap((c) => c.languages.map((l) => `  (${q(c.id)}, ${q(l)})`)).join(',\n')};

insert into public.creator_social_accounts (creator_id, platform, username, profile_url, followers_count, verified) values
${creators
  .flatMap((c) =>
    Object.entries(c.socials).map(([platform, followers]) => {
      const handle = `${c.slug.replace(/-/g, '.')}${platform === 'youtube' ? '' : '.creates'}`
      const url = platform === 'youtube' ? `https://www.youtube.com/@${handle}` : `https://www.instagram.com/${handle}`
      return `  (${q(c.id)}, ${q(platform)}, ${q(handle)}, ${q(url)}, ${followers}, ${c.verified})`
    }),
  )
  .join(',\n')};
`)

emit(`insert into public.creator_services (id, creator_id, title, description, price, delivery_days, revisions_included, includes, content_type, requires_shipping, active, sort_order) values
${creators
  .flatMap((c) =>
    c.services.map((s, k) => `  (${q(s.id)}, ${q(c.id)}, ${q(s.title)}, ${q(s.description)}, ${s.price}, ${s.days}, ${s.revisions}, ${tarr(s.includes)}, ${q(s.contentType)}, ${s.shipping}, true, ${k})`),
  )
  .join(',\n')};

insert into public.service_addons (id, service_id, name, description, price, addon_type, extra_revisions, delivery_days_override, active, sort_order) values
${creators
  .flatMap((c) =>
    c.services.flatMap((s) =>
      s.addons.map((a, k) => `  (${q(a.id)}, ${q(s.id)}, ${q(a.name)}, ${q(a.desc)}, ${a.price}, ${q(a.type)}, ${a.extra ?? 0}, ${a.override ?? 'null'}, true, ${k})`),
    ),
  )
  .join(',\n')};
`)

// portfolio: 4 per creator (published ones), from category artwork
let pIdx = 0
const portfolioValues = []
creators.forEach((c) => {
  const n = c.status === 'published' ? 4 : c.status === 'pending_review' ? 3 : 1
  for (let k = 0; k < n; k++) {
    const cat = c.cats[k % c.cats.length]
    const variant = ((c.idx + k * 2) % 6) + 1
    const titles = portfolioTitles[cat]
    const madeFor = rand() > 0.5 ? pick(brands).name : null
    portfolioValues.push(
      `  (${q(id('f1000000', ++pIdx))}, ${q(c.id)}, 'image', ${q(titles[(c.idx + k) % titles.length])}, null, ${q(`/demo/portfolio/${cat}-${variant}.svg`)}, null, (select id from public.categories where slug = ${q(cat)}), ${q(pick(['instagram', 'youtube', 'instagram']))}, ${q(madeFor)}, 800, 1000, ${k})`,
    )
  }
})
emit(`insert into public.portfolio_items (id, creator_id, type, title, description, media_url, thumbnail_url, category_id, platform, brand_name, width, height, sort_order) values
${portfolioValues.join(',\n')};

update public.profiles p set onboarding_completed = true, avatar_url = c.profile_image_url
from public.creators c where c.profile_id = p.id;
update public.profiles p set onboarding_completed = true, avatar_url = b.brand_logo_url, phone = b.contact_phone
from public.brands b where b.profile_id = p.id;
`)

// ---------------------------------------------------------------------------
// briefs (drafts first; some are sent/answered through the workflow)
// ---------------------------------------------------------------------------
const briefDefs = [
  { key: 'b1', brand: 'kumkum-naturals', title: 'Kesar Glow serum launch', objective: 'Launch our new saffron serum with authentic routine content ahead of the festive season.', product: 'Kesar Glow Serum 30ml', cat: 'skincare', ctype: 'reel', deliverables: '1 reel (30–45s) + 3 stories', audience: 'Women 22–35 in metros who follow skincare creators', tone: 'Warm, honest, glowy — no heavy filters', talking: ['Cold-pressed saffron + niacinamide', 'Non-sticky in humid weather', 'Made in small batches in Jaipur'], dont: ['Miracle', 'Overnight results', 'Fairness'], budget: 6000, usage: 'Organic social + 3 months paid ads', platform: 'Instagram', days: 21, send: 'rhea', respond: true },
  { key: 'b2', brand: 'kumkum-naturals', title: 'Diwali gifting box UGC', objective: 'Ad-ready UGC for our Diwali gift box.', product: 'Festive Ritual Box', cat: 'ugc', ctype: 'ugc_video', deliverables: '2 UGC videos with 3 hooks each', audience: 'Gift buyers 25–45', tone: 'Festive, warm, family', talking: ['Handmade diyas included', 'Ships in 48 hours'], dont: ['Cheap'], budget: 5000, usage: 'Paid ads — 6 months', platform: 'Meta ads', days: 30, send: 'priya', respond: true },
  { key: 'b3', brand: 'kumkum-naturals', title: 'Monsoon hair-oil routine', objective: 'Educate on pre-wash oiling for monsoon frizz.', product: 'Bhringraj Hair Oil', cat: 'beauty', ctype: 'reel', deliverables: '1 reel', audience: 'Women 20–40', tone: 'Calm, educational', talking: ['Warm the oil first', 'Leave for 30 minutes'], dont: ['Hair fall cure'], budget: 4000, usage: 'Organic only', platform: 'Instagram', days: 40 },
  { key: 'b4', brand: 'nimbus-audio', title: 'Nimbus Buds Pro — creator unboxing', objective: 'Drive awareness for the Buds Pro launch.', product: 'Nimbus Buds Pro', cat: 'technology', ctype: 'unboxing', deliverables: '1 unboxing video + 1 short', audience: 'Tech buyers 18–35', tone: 'Crisp, honest, specs explained simply', talking: ['40-hour battery', 'ANC with transparency mode', 'Low-latency gaming mode'], dont: ['Best in the world'], budget: 15000, usage: 'Organic + whitelisting 1 month', platform: 'YouTube', days: 25, send: 'kabir', respond: true },
  { key: 'b5', brand: 'nimbus-audio', title: 'Gaming mode short', objective: 'Show latency in real gameplay.', product: 'Nimbus Buds Pro', cat: 'gaming', ctype: 'short', deliverables: '1 Short', audience: 'Mobile gamers', tone: 'High energy', talking: ['Gaming mode toggle'], dont: [], budget: 6000, usage: 'Organic', platform: 'YouTube', days: 20, send: 'rohan', respond: false },
  { key: 'b6', brand: 'saffron-street', title: 'Festive co-ords edit', objective: 'Showcase festive co-ord sets for Navratri and Diwali.', product: 'Festive Co-ord Collection', cat: 'fashion', ctype: 'reel', deliverables: 'Try-on reel with 3 looks', audience: 'Women 20–35', tone: 'Playful, festive', talking: ['Breathable cotton', 'Pockets!'], dont: ['Discount'], budget: 7000, usage: 'Organic', platform: 'Instagram', days: 18, send: 'ishita', respond: true },
  { key: 'b7', brand: 'saffron-street', title: 'Everyday kurtas lookbook', objective: 'Lookbook photos for the website.', product: 'Everyday Kurtas', cat: 'photography', ctype: 'photo', deliverables: '10 photos', audience: 'Website visitors', tone: 'Clean, natural', talking: [], dont: [], budget: 8000, usage: 'Website + ads 1 year', platform: 'Website', days: 35 },
  { key: 'b8', brand: 'peak-protein-labs', title: 'Whey review with taste test', objective: 'Honest taste and mixability content.', product: 'Peak Whey — Kesar Pista', cat: 'fitness', ctype: 'ugc_video', deliverables: '1 UGC video', audience: 'Gym-goers 20–35', tone: 'Honest, energetic', talking: ['24g protein', 'No added sugar'], dont: ['Steroid', 'Guaranteed muscle'], budget: 3000, usage: 'Paid ads 3 months', platform: 'Instagram', days: 22, send: 'arjun', respond: true },
  { key: 'b9', brand: 'chai-circle', title: 'Chai & snacks evening reel', objective: 'Cosy evening chai ritual content.', product: 'Darjeeling Evening Blend', cat: 'food', ctype: 'reel', deliverables: '1 reel', audience: 'Tea lovers', tone: 'Cosy, nostalgic', talking: ['Single estate', 'Pairs with nimki'], dont: [], budget: 4000, usage: 'Organic', platform: 'Instagram', days: 16, send: 'ananya', respond: true },
  { key: 'b10', brand: 'urban-tiffin-co', title: 'Office lunch UGC', objective: 'Ads showing a hot homestyle lunch at work.', product: 'Daily Tiffin Plan', cat: 'ugc', ctype: 'ugc_video', deliverables: '2 UGC videos', audience: 'Working professionals in Mumbai', tone: 'Relatable', talking: ['Delivered by 1 pm', 'Weekly menu'], dont: [], budget: 4000, usage: 'Paid ads', platform: 'Meta ads', days: 14 },
  { key: 'b11', brand: 'byte-gadgets', title: 'Smart plug setup in 60s', objective: 'Show how easy setup is.', product: 'Byte Smart Plug', cat: 'technology', ctype: 'reel', deliverables: '1 reel', audience: 'Homeowners 25–45', tone: 'Simple, helpful', talking: ['Works with voice assistants', 'Energy tracking'], dont: [], budget: 5000, usage: 'Organic + ads 1 month', platform: 'Instagram', days: 20, send: 'karthik', respond: true },
  { key: 'b12', brand: 'wander-bags', title: 'Train trip packing', objective: 'Packing video for our 3-day backpack.', product: 'Trail 28L Backpack', cat: 'travel', ctype: 'ugc_video', deliverables: '1 video', audience: 'Young travellers', tone: 'Adventurous', talking: ['Laptop sleeve', 'Lockable zips'], dont: [], budget: 3500, usage: 'Organic', platform: 'Instagram', days: 24, send: 'tenzin', respond: true },
  { key: 'b13', brand: 'little-sprouts', title: 'Bath-time routine', objective: 'Gentle bath routine with our wash.', product: 'Calm Baby Wash', cat: 'parenting', ctype: 'reel', deliverables: '1 reel + photos', audience: 'New parents', tone: 'Gentle, real', talking: ['Tear-free', 'Plant-based'], dont: ['Cures eczema'], budget: 5000, usage: 'Organic', platform: 'Instagram', days: 19, send: 'nisha', respond: true },
  { key: 'b14', brand: 'loom-and-lace', title: 'Handloom saree drape tutorial', objective: 'Drape tutorial for first-time saree wearers.', product: 'Patola Silk Saree', cat: 'fashion', ctype: 'tutorial', deliverables: '1 tutorial reel', audience: 'Women 22–40', tone: 'Elegant', talking: ['Artisan-woven'], dont: [], budget: 6000, usage: 'Organic', platform: 'Instagram', days: 28 },
  { key: 'b15', brand: 'chai-circle', title: 'Winter blend launch', objective: 'Pre-launch teaser for the winter spice blend.', product: 'Winter Spice Chai', cat: 'food', ctype: 'reel', deliverables: '1 reel', audience: 'Tea lovers', tone: 'Warm', talking: ['Cinnamon + clove'], dont: [], budget: 3500, usage: 'Organic', platform: 'Instagram', days: 45 },
  { key: 'b16', brand: 'peak-protein-labs', title: '7-day hydration challenge', objective: 'Electrolyte habit challenge.', product: 'Peak Hydrate', cat: 'fitness', ctype: 'story', deliverables: '7 stories', audience: 'Runners', tone: 'Motivating', talking: ['No sugar'], dont: [], budget: 7000, usage: 'Organic', platform: 'Instagram', days: 30, send: 'harsh', respond: null },
]
briefDefs.forEach((b, i) => (b.id = id('91000000', i + 1)))
const briefById = Object.fromEntries(briefDefs.map((b) => [b.key, b]))

emit(`insert into public.briefs (id, brand_id, title, campaign_objective, product_name, category_id, content_type, deliverables, target_audience, tone, reference_links, talking_points, do_not_say, deadline, budget, usage_rights, platform) values
${briefDefs
  .map(
    (b) =>
      `  (${q(b.id)}, ${q(byBrand[b.brand].id)}, ${q(b.title)}, ${q(b.objective)}, ${q(b.product)}, (select id from public.categories where slug = ${q(b.cat)}), ${q(b.ctype)}, ${q(b.deliverables)}, ${q(b.audience)}, ${q(b.tone)}, ${tarr(['https://www.instagram.com/reel/example'])}, ${tarr(b.talking)}, ${tarr(b.dont)}, current_date + ${b.days}, ${b.budget}, ${q(b.usage)}, ${q(b.platform)})`,
  )
  .join(',\n')};
`)

for (const b of briefDefs.filter((x) => x.send)) {
  const brand = byBrand[b.brand]
  const creator = byFirst[b.send]
  emit(`select pg_temp.as_user(${q(brand.userId)}); select public.send_brief(${q(b.id)}, ${q(creator.id)});`)
  if (b.respond !== null && b.respond !== undefined) {
    emit(
      `select pg_temp.as_user(${q(creator.userId)}); select public.respond_to_brief(${q(b.id)}, ${b.respond}, ${q(b.respond ? 'Love this — happy to take it on!' : 'Thanks! My calendar is full this month, but I would love to work together next time.')});`,
    )
  }
}

// ---------------------------------------------------------------------------
// orders through the real workflow
// ---------------------------------------------------------------------------
// [key, brand slug, creator first, service index, addon indexes, final state, days ago, brief key]
const orderDefs = [
  ['o1', 'kumkum-naturals', 'aanya', 0, [0], 'completed', 62, null],
  ['o2', 'kumkum-naturals', 'rhea', 0, [], 'completed', 55, 'b1'],
  ['o3', 'kumkum-naturals', 'priya', 0, [0, 1], 'completed', 48, 'b2'],
  ['o4', 'kumkum-naturals', 'kavya', 0, [], 'completed', 40, null],
  ['o5', 'kumkum-naturals', 'aanya', 1, [], 'delivered', 6, null],
  ['o6', 'kumkum-naturals', 'riya', 0, [], 'revision_submitted', 7, null],
  ['o7', 'kumkum-naturals', 'aanya', 2, [], 'creator_pending', 1, null],
  ['o8', 'kumkum-naturals', 'zoya', 0, [], 'in_progress', 3, null],
  ['o9', 'kumkum-naturals', 'tanvi', 0, [], 'payment_pending', 0, null],
  ['o10', 'nimbus-audio', 'kabir', 0, [0], 'completed', 70, 'b4'],
  ['o11', 'nimbus-audio', 'rohan', 1, [], 'completed', 45, null],
  ['o12', 'nimbus-audio', 'neel', 1, [], 'completed', 33, null],
  ['o13', 'nimbus-audio', 'aarav', 0, [], 'shipped', 4, null],
  ['o14', 'saffron-street', 'ishita', 0, [], 'completed', 58, 'b6'],
  ['o15', 'saffron-street', 'meher', 0, [], 'completed', 44, null],
  ['o16', 'saffron-street', 'riya', 1, [], 'completed', 26, null],
  ['o17', 'saffron-street', 'zoya', 1, [], 'awaiting_shipment', 2, null],
  ['o18', 'peak-protein-labs', 'arjun', 2, [], 'completed', 52, 'b8'],
  ['o19', 'peak-protein-labs', 'harsh', 0, [], 'completed', 37, null],
  ['o20', 'peak-protein-labs', 'arjun', 0, [1], 'revision_requested', 5, null],
  ['o21', 'chai-circle', 'ananya', 0, [], 'completed', 41, 'b9'],
  ['o22', 'chai-circle', 'sana', 0, [], 'completed', 30, null],
  ['o23', 'chai-circle', 'manish', 2, [], 'disputed', 9, null],
  ['o24', 'urban-tiffin-co', 'priya', 0, [], 'completed', 35, null],
  ['o25', 'urban-tiffin-co', 'tanvi', 0, [], 'completed', 21, null],
  ['o26', 'urban-tiffin-co', 'simran', 0, [], 'delivered', 5, null],
  ['o27', 'byte-gadgets', 'karthik', 2, [], 'completed', 29, 'b11'],
  ['o28', 'byte-gadgets', 'siddharth', 0, [], 'completed', 19, null],
  ['o29', 'byte-gadgets', 'aarav', 1, [], 'declined', 8, null],
  ['o30', 'wander-bags', 'tenzin', 0, [], 'completed', 24, 'b12'],
  ['o31', 'wander-bags', 'mira', 0, [], 'completed', 17, null],
  ['o32', 'wander-bags', 'devtara', 0, [], 'in_progress', 4, null],
  ['o33', 'little-sprouts', 'nisha', 0, [], 'completed', 31, 'b13'],
  ['o34', 'little-sprouts', 'lavanya', 0, [], 'completed', 14, null],
  ['o35', 'little-sprouts', 'pooja', 0, [], 'creator_pending', 1, null],
  ['o36', 'loom-and-lace', 'imran', 1, [], 'completed', 12, null],
  ['o37', 'loom-and-lace', 'aditya', 0, [], 'in_progress', 3, null],
  ['o38', 'kumkum-naturals', 'aanya', 0, [], 'revision_requested', 4, null],
]
byFirst['devtara'] = creators.find((c) => c.name === 'Dev & Tara')

const address = (c) => ({
  recipient_name: c.name.replace(' & ', ' and '),
  phone: `+91 9${String(8000000000 + c.idx * 7919).slice(1, 10)}`,
  address: `${10 + c.idx}, ${pick(['Lotus Residency', 'Palm Grove Apartments', 'Shanti Nagar', 'Green Park Enclave', 'Sai Krupa Society'])}, ${pick(['MG Road', 'Station Road', 'Link Road', '2nd Cross'])}`,
  city: c.city,
  state: c.state,
  postal_code: String(110001 + c.idx * 1373).slice(0, 6),
})

const reviewComments = [
  'Delivered two days early and the hook in the first three seconds was spot on. Our click-through on the ad jumped.',
  'Super easy to brief — asked the right questions and nailed our brand tone.',
  'Loved the natural lighting and how the product was shown in real use.',
  'Great communication throughout. One small revision and it was perfect.',
  'The video felt genuinely personal and our audience responded really well.',
  'Clean edits, clear voiceover, and all raw files shared neatly.',
  'Professional from start to finish. Booking again for Diwali.',
  'Good content, though it took the full timeline. Happy overall.',
  'Exactly what we needed for our product page — authentic and crisp.',
  'Captured the texture of our product beautifully.',
]
const responses = ['Thank you! Loved working on this launch.', 'Thanks so much — excited for the next one!', 'Really appreciate the clear brief. Anytime!', 'Thank you for the kind words ðŸ™']

emit(`
create temp table seed_orders (key text primary key, id uuid, days_ago int);
create or replace function pg_temp.o(k text) returns uuid language sql as $$ select id from seed_orders where key = k $$;
`)

const orderMeta = []
for (const [key, brandSlug, first, svcIdx, addonIdx, final, daysAgo, briefKey] of orderDefs) {
  const brand = byBrand[brandSlug]
  const creator = byFirst[first]
  const svc = creator.services[Math.min(svcIdx, creator.services.length - 1)]
  const addons = addonIdx.map((i) => svc.addons[i]).filter(Boolean).map((a) => a.id)
  const brief = briefKey ? briefById[briefKey] : null
  orderMeta.push({ key, brand, creator, svc, final, daysAgo })
  const req = brief ? null : `Please feature our product naturally and mention ${brand.name} in the first five seconds.`
  const B = `select pg_temp.as_user(${q(brand.userId)});`
  const C = `select pg_temp.as_user(${q(creator.userId)});`
  emit(`\n-- ${key}: ${brand.name} × ${creator.name} → ${final}`)
  emit(`${B} insert into seed_orders (key, id, days_ago) select ${q(key)}, (public.create_order(${q(svc.id)}, ${uarr(addons)}, ${brief ? q(brief.id) : 'null'}, ${q(req)})).id, ${daysAgo};`)
  if (final === 'payment_pending') continue
  emit(
    `select public.register_payment_attempt(pg_temp.o(${q(key)}), ${q(brand.userId)}, ${q(`order_SEED${key.toUpperCase()}`)}, (select total_amount from public.orders where id = pg_temp.o(${q(key)})), 'INR', '{"seed":true}'::jsonb);`,
  )
  emit(
    `select public.confirm_order_payment(${q(`order_SEED${key.toUpperCase()}`)}, ${q(`pay_SEED${key.toUpperCase()}`)}, 'seed', ${q(pick(['upi', 'upi', 'card', 'netbanking']))}, (select round(total_amount * 100)::bigint from public.orders where id = pg_temp.o(${q(key)})), '{"seed":true}'::jsonb);`,
  )
  if (final === 'creator_pending') continue
  if (final === 'declined') {
    emit(`${C} select public.decline_order(pg_temp.o(${q(key)}), 'Fully booked for the next three weeks — sorry! Happy to take it up after that.');`)
    continue
  }
  emit(`${C} select public.accept_order(pg_temp.o(${q(key)}), ${svc.shipping ? jsonb(address(creator)) : 'null'});`)
  if (final === 'awaiting_shipment') continue
  if (svc.shipping) {
    emit(`${B} select public.mark_order_shipped(pg_temp.o(${q(key)}), ${q(pick(['Delhivery', 'Blue Dart', 'DTDC', 'Ekart']))}, ${q(`TRK${String(900000000 + orderMeta.length * 7331)}`)}, null);`)
    if (final === 'shipped') continue
    emit(`${C} select public.mark_product_received(pg_temp.o(${q(key)}));`)
  }
  emit(`${C} select public.start_order_work(pg_temp.o(${q(key)}));`)
  if (final === 'in_progress') continue
  const link = (n) => jsonb([{ external_url: `https://drive.example.com/spotlit-demo/${key}-v${n}`, file_name: n === 1 ? 'Final video (Drive folder)' : `Revision ${n - 1} (Drive folder)` }])
  emit(`${C} select public.submit_deliverables(pg_temp.o(${q(key)}), ${link(1)}, 'Here you go! Captions and raw clips are in the folder.');`)
  if (final === 'delivered') continue
  if (final === 'disputed') {
    emit(`${B} select public.open_dispute(pg_temp.o(${q(key)}), 'Content not as described', 'The video does not show the product being used and the mandatory talking points were skipped entirely.');`)
    emit(`${C} select public.add_dispute_message((select id from public.disputes where order_id = pg_temp.o(${q(key)})), 'I covered the taste test as agreed in chat — sharing the timestamps: 0:04 and 0:21.', '[]'::jsonb);`)
    continue
  }
  const allowed = svc.revisions + addonIdx.map((i) => svc.addons[i]).filter(Boolean).reduce((s, a) => s + (a.extra ?? 0), 0)
  const needsRevision = ['revision_requested', 'revision_submitted'].includes(final) || (final === 'completed' && rand() > 0.6)
  if (needsRevision && allowed > 0) {
    emit(`${B} select public.request_revision(pg_temp.o(${q(key)}), 'Please brighten the first five seconds and show the label clearly.', 'The product label should be readable in the opening shot. Everything else is great!', '[]'::jsonb);`)
    if (final === 'revision_requested') continue
    emit(`${C} select public.submit_deliverables(pg_temp.o(${q(key)}), ${link(2)}, 'Updated the opening shot and colour grade.');`)
    if (final === 'revision_submitted') continue
  }
  if (final !== 'completed') continue
  emit(`${B} select public.approve_order(pg_temp.o(${q(key)}));`)
  const rating = rand() > 0.85 ? 4 : rand() > 0.93 ? 3 : 5
  emit(`${B} select public.submit_review(pg_temp.o(${q(key)}), ${rating}, ${q(pick(reviewComments))});`)
  if (rand() > 0.55) emit(`${C} select public.respond_to_review((select id from public.reviews where order_id = pg_temp.o(${q(key)}) and reviewer_role = 'brand'), ${q(pick(responses))});`)
  if (rand() > 0.7) emit(`${C} select public.submit_review(pg_temp.o(${q(key)}), 5, ${q(pick(['Clear brief and quick approvals — a pleasure to work with.', 'Product arrived fast and feedback was specific. Great brand!', 'Paid on time, super respectful team.']))});`)
}

// inquiry-only conversations (no orders yet)
const inquiries = [
  ['saffron-street', 'mira', 'Diwali lookbook'],
  ['kumkum-naturals', 'kavya', 'winter skincare'],
  ['nimbus-audio', 'karthik', 'student discount'],
  ['peak-protein-labs', 'harsh', 'New Year fitness'],
  ['chai-circle', 'sana', 'Ramadan iftar'],
  ['byte-gadgets', 'aarav', 'smart home'],
  ['little-sprouts', 'nisha', 'monsoon baby care'],
  ['wander-bags', 'devtara', 'Himalayan road trip'],
]
for (const [brandSlug, first] of inquiries) {
  emit(`select pg_temp.as_user(${q(byBrand[brandSlug].userId)}); select public.start_conversation(${q(byFirst[first].id)}, null);`)
}

// ---------------------------------------------------------------------------
// messages (explicit ids so they can be timestamped after backdating)
// ---------------------------------------------------------------------------
let mIdx = 0
const messageTimes = []
const conv = (b, c) => `(select id from public.conversations where brand_id = ${q(b.id)} and creator_id = ${q(c.id)})`
function msg(b, c, sender, body, anchorSql, offsetHours) {
  const mid = id('71000000', ++mIdx)
  emit(`insert into public.messages (id, conversation_id, sender_id, body) values (${q(mid)}, ${conv(b, c)}, ${q(sender)}, ${q(body)});`)
  messageTimes.push(`update public.messages set created_at = ${anchorSql} + interval '${offsetHours} hours' where id = ${q(mid)};`)
}
emit('\n-- conversation messages')
const seenPairs = new Set()
for (const o of orderMeta) {
  const pair = `${o.brand.id}:${o.creator.id}`
  const anchor = `(select coalesce(paid_at, created_at) from public.orders where id = pg_temp.o(${q(o.key)}))`
  if (o.final === 'payment_pending') continue
  const first = !seenPairs.has(pair)
  seenPairs.add(pair)
  msg(o.brand, o.creator, o.brand.userId, first ? `Hi ${o.creator.first}! Excited to work with you on “${o.svc.title}”. The brief has everything — shout if anything’s unclear.` : `Hi again ${o.creator.first}! Loved the last one, so here’s another order ðŸ™Œ`, anchor, 1)
  if (['creator_pending'].includes(o.final)) continue
  msg(o.brand, o.creator, o.creator.userId, `Thanks for booking, ${o.brand.name} team! Quick one — should I mention the price, or keep it to the benefits?`, anchor, 3)
  msg(o.brand, o.creator, o.brand.userId, 'Benefits only please, plus a quick mention of free shipping above ₹999.', anchor, 4)
  if (o.final === 'declined') continue
  if (o.svc.shipping && !['awaiting_shipment'].includes(o.final)) {
    msg(o.brand, o.creator, o.brand.userId, 'The product is on its way — tracking is on the order page.', anchor, 20)
    if (o.final !== 'shipped') msg(o.brand, o.creator, o.creator.userId, 'Received it today, the packaging is lovely!', anchor, 60)
  }
  if (['delivered', 'revision_requested', 'revision_submitted', 'completed', 'disputed'].includes(o.final)) {
    msg(o.brand, o.creator, o.creator.userId, 'Delivered! Let me know what you think ðŸ™‚', anchor, 110)
  }
  if (o.final === 'completed') msg(o.brand, o.creator, o.brand.userId, 'This looks great — approved! Thank you.', anchor, 130)
  if (o.final === 'revision_requested') msg(o.brand, o.creator, o.brand.userId, 'Almost there! Requested a small revision on the opening shot.', anchor, 115)
}
for (const [brandSlug, first, theme] of inquiries) {
  const b = byBrand[brandSlug]
  const c = byFirst[first]
  const anchor = `(now() - interval '${int(2, 9)} days')`
  msg(b, c, b.userId, `Hi ${c.first}, we’re planning a ${theme} campaign next month. Would you be open to two reels?`, anchor, 0)
  msg(b, c, c.userId, 'Hi! Yes, I’d love to. Could you share product details and timelines?', anchor, 2)
  msg(b, c, b.userId, 'Sure — sending a brief this week. What’s your usual turnaround?', anchor, 3)
  if (rand() > 0.4) msg(b, c, c.userId, 'About five days after the product arrives. Rates are on my storefront!', anchor, 5)
}

// ---------------------------------------------------------------------------
// wishlists
// ---------------------------------------------------------------------------
emit('\n-- wishlists')
brands.forEach((b, i) => {
  const picks = [...published].sort(() => rand() - 0.5).slice(0, 3 + (i % 4))
  emit(
    `insert into public.wishlist_items (wishlist_id, creator_id) select w.id, x.cid from public.wishlists w, (values ${picks.map((c) => `(${q(c.id)}::uuid)`).join(', ')}) as x(cid) where w.brand_id = ${q(b.id)} and w.is_default on conflict do nothing;`,
  )
})
const extraLists = [
  ['kumkum-naturals', 'Diwali campaign', 'Festive gifting creators', ['aanya', 'priya', 'rhea', 'simran', 'meher']],
  ['kumkum-naturals', 'UGC for ads', 'Ad-ready creators', ['priya', 'tanvi', 'kavya', 'diya']],
  ['saffron-street', 'Navratri looks', null, ['ishita', 'zoya', 'riya', 'meher']],
  ['nimbus-audio', 'Tech reviewers', 'Launch shortlist', ['kabir', 'karthik', 'siddharth', 'aarav']],
  ['peak-protein-labs', 'Fitness coaches', null, ['arjun', 'harsh']],
]
extraLists.forEach(([slug, name, desc, firsts], i) => {
  const wid = id('81000000', i + 1)
  emit(`insert into public.wishlists (id, brand_id, name, description) values (${q(wid)}, ${q(byBrand[slug].id)}, ${q(name)}, ${q(desc)});`)
  emit(`insert into public.wishlist_items (wishlist_id, creator_id) values ${firsts.map((f) => `(${q(wid)}, ${q(byFirst[f].id)})`).join(', ')};`)
})

// ---------------------------------------------------------------------------
// payouts
// ---------------------------------------------------------------------------
emit(`
-- payouts
select pg_temp.as_user(${q(byFirst.rhea.userId)}); select public.save_payout_method('upi', 'Rhea Menon', 'rhea.menon@okaxis', null, null, null);
select public.create_payout_request(${q(byFirst.rhea.userId)}, null);
select public.complete_payout((select id from public.payout_requests where creator_id = ${q(byFirst.rhea.id)}), ${q(ADMIN.id)}, 'paid', 'manual', 'AXISN26091400412', 'Paid via UPI');
select pg_temp.as_user(${q(byFirst.kabir.userId)}); select public.save_payout_method('bank_transfer', 'Kabir Sethi', null, '50100234567890', 'HDFC0001234', 'HDFC Bank');
select public.create_payout_request(${q(byFirst.kabir.userId)}, 'Please process before month end if possible.');
select public.complete_payout((select id from public.payout_requests where creator_id = ${q(byFirst.kabir.id)}), ${q(ADMIN.id)}, 'processing', 'manual', null, 'NEFT initiated');
select pg_temp.as_user(${q(byFirst.ishita.userId)}); select public.save_payout_method('upi', 'Ishita Rao', 'ishita.rao@okhdfcbank', null, null, null);
select public.create_payout_request(${q(byFirst.ishita.userId)}, null);
select pg_temp.as_user(${q(byFirst.aanya.userId)}); select public.save_payout_method('bank_transfer', 'Aanya Kapoor', null, '002301567894', 'ICIC0000023', 'ICICI Bank');
`)

// ---------------------------------------------------------------------------
// trust & safety, contact, analytics
// ---------------------------------------------------------------------------
emit(`
-- reports + contact messages
select pg_temp.as_user(${q(byBrand['byte-gadgets'].userId)}); select public.create_report('creator', ${q(byFirst.gauri.id)}, 'Impersonation', 'This profile uses photos that look like a different creator.');
select pg_temp.as_user(${q(byFirst.manish.userId)}); select public.create_report('order', pg_temp.o('o23'), 'Brand unresponsive', 'The brand has not replied to my messages about the dispute for two days.');
insert into public.contact_messages (name, email, company, topic, message) values
  ('Rakesh Menon', 'rakesh@agency.example', 'Northstar Media', 'Partnerships', 'We manage 40+ creators in Kerala and would like to onboard them in bulk. Is there an agency workflow?'),
  ('Shreya Gupta', 'shreya@brand.example', 'Pure Petal', 'Brand enquiry', 'Do you support barter collaborations, or only paid orders? We are a new skincare brand.'),
  ('Aman Verma', 'aman.verma@mail.example', null, 'Payments & payouts', 'My payout shows processing for two days — when should I expect it in my bank?');

-- search analytics
${brands
  .map((b, i) =>
    Array.from({ length: 4 + (i % 5) }, (_, k) => {
      const cat = pick(Object.keys(catNames))
      return `insert into public.search_events (profile_id, query, filters, results_count, created_at) values (${q(b.userId)}, ${q(`${catNames[cat].toLowerCase()} creators`)}, ${jsonb({ category: cat })}, ${int(3, 18)}, now() - interval '${int(1, 29)} days ${int(0, 23)} hours');`
    }).join('\n'),
  )
  .join('\n')}

-- profile views over the last 30 days (deterministic spread)
${published
  .map((c, i) => {
    const n = 25 + ((i * 37) % 180)
    return `insert into public.creator_profile_views (creator_id, viewer_id, viewer_role, created_at) select ${q(c.id)}, case when g % 4 = 0 then ${q(brands[i % brands.length].userId)}::uuid end, case when g % 4 = 0 then 'brand'::public.user_role end, now() - ((g * 7919 + ${i * 131}) % 43200) * interval '1 minute' from generate_series(1, ${n}) g;`
  })
  .join('\n')}
update public.creators c set profile_views = v.cnt + 40 + (abs(hashtext(c.id::text)) % 400)
from (select creator_id, count(*)::int as cnt from public.creator_profile_views group by creator_id) v where v.creator_id = c.id;
`)

// ---------------------------------------------------------------------------
// backdating: spread entities + order timelines over the last ~70 days
// ---------------------------------------------------------------------------
emit(`
-- -----------------------------------------------------------------------------
-- backdate timelines so dashboards and charts look realistic
-- -----------------------------------------------------------------------------
create or replace function pg_temp.backdate_order(p_order uuid, p_days int) returns void language plpgsql as $$
declare
  v_start timestamptz := now() - make_interval(days => p_days) - interval '4 hours';
  v_step interval := case when p_days <= 2 then interval '2 hours' when p_days <= 7 then interval '9 hours' else interval '19 hours' end;
  v_count int;
  r record;
  i int := 0;
begin
  select count(*) into v_count from public.order_status_history where order_id = p_order;
  -- keep every event strictly in the past and in order
  v_step := least(v_step, (now() - interval '15 minutes' - v_start) / greatest(v_count, 1));
  for r in select id from public.order_status_history where order_id = p_order order by created_at, id loop
    update public.order_status_history set created_at = v_start + i * v_step where id = r.id;
    i := i + 1;
  end loop;
  update public.orders o set
    created_at = v_start,
    updated_at = coalesce((select max(h.created_at) from public.order_status_history h where h.order_id = o.id), v_start),
    paid_at = (select min(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'order_placed'),
    accepted_at = (select min(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'accepted'),
    started_at = (select min(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'in_progress'),
    delivered_at = (select max(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status in ('delivered', 'revision_submitted')),
    approved_at = (select max(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'approved'),
    completed_at = (select max(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'completed'),
    cancelled_at = (select max(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'cancelled'),
    due_at = case when o.due_at is null then null else
      coalesce((select max(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'received'),
               (select min(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'accepted'))
      + make_interval(days => o.delivery_days) end
  where o.id = p_order;
  update public.payments p set created_at = v_start, captured_at = (select paid_at from public.orders where id = p_order) where p.order_id = p_order;
  update public.creator_earnings e set created_at = o.completed_at, available_at = o.completed_at from public.orders o where o.id = p_order and e.order_id = p_order;
  update public.order_deliverables d set created_at = x.t
  from (select h.created_at as t, row_number() over (order by h.created_at) as rn from public.order_status_history h
        where h.order_id = p_order and ((h.new_status = 'delivered' and h.old_status = 'in_progress') or h.new_status = 'revision_submitted')) x
  where d.order_id = p_order and d.round = x.rn;
  update public.order_revisions rv set created_at = x.t from (select h.created_at as t, row_number() over (order by h.created_at) as rn from public.order_status_history h where h.order_id = p_order and h.new_status = 'revision_requested') x
  where rv.order_id = p_order and rv.revision_number = x.rn;
  update public.order_revisions rv set submitted_at = x.t from (select h.created_at as t, row_number() over (order by h.created_at) as rn from public.order_status_history h where h.order_id = p_order and h.new_status = 'revision_submitted') x
  where rv.order_id = p_order and rv.revision_number = x.rn;
  update public.shipping_details s set
    address_submitted_at = (select accepted_at from public.orders where id = p_order),
    shipped_at = (select min(h.created_at) from public.order_status_history h where h.order_id = p_order and h.new_status = 'shipped'),
    received_at = (select min(h.created_at) from public.order_status_history h where h.order_id = p_order and h.new_status = 'received')
  where s.order_id = p_order and s.address is not null;
  update public.reviews set created_at = (select completed_at from public.orders where id = p_order) + interval '5 hours' where order_id = p_order;
  update public.disputes set created_at = (select max(h.created_at) from public.order_status_history h where h.order_id = p_order and h.new_status = 'disputed') where order_id = p_order;
  update public.notifications n set created_at = least((select updated_at from public.orders where id = p_order), now() - interval '10 minutes')
  where n.reference_id = p_order;
end;
$$;

alter table public.orders disable trigger orders_set_updated_at;
select pg_temp.backdate_order(id, days_ago) from seed_orders;
alter table public.orders enable trigger orders_set_updated_at;

-- system messages sit at payment time; dialog messages follow their order
update public.messages m set created_at = o.paid_at
from public.orders o where m.message_type = 'system' and (m.metadata ->> 'order_id')::uuid = o.id and o.paid_at is not null;
${messageTimes.join('\n')}
update public.messages set created_at = least(created_at, now() - interval '2 minutes');

update public.conversations c set
  created_at = x.first_at,
  last_message_at = x.last_at,
  last_message_preview = x.preview,
  last_message_sender_id = x.sender
from (
  select distinct on (conversation_id) conversation_id, created_at as last_at, left(coalesce(body, ''), 160) as preview, sender_id as sender,
         min(created_at) over (partition by conversation_id) as first_at
  from public.messages order by conversation_id, created_at desc
) x where x.conversation_id = c.id;

-- everyone has read their chats except a few fresh ones for the demo accounts
update public.conversation_participants cp set last_read_at = c.last_message_at
from public.conversations c where c.id = cp.conversation_id;
update public.conversation_participants cp set last_read_at = c.last_message_at - interval '3 hours'
from public.conversations c
where c.id = cp.conversation_id and c.last_message_at > now() - interval '3 days'
  and cp.profile_id in (${q(byBrand['kumkum-naturals'].userId)}, ${q(byFirst.aanya.userId)});
update public.notifications set read = true, read_at = created_at + interval '1 hour' where created_at < now() - interval '3 days';
delete from public.notifications n where n.type = 'message'
  and exists (select 1 from public.conversation_participants cp join public.conversations c on c.id = cp.conversation_id
              where cp.profile_id = n.user_id and c.id = n.reference_id and cp.last_read_at >= c.last_message_at);

-- payouts happened recently
update public.payout_requests set created_at = now() - interval '5 days', updated_at = now() - interval '3 days', processed_at = case when status = 'paid' then now() - interval '3 days' end where status in ('paid', 'processing');
update public.payout_requests set created_at = now() - interval '1 day' where status = 'pending';
update public.payout_transactions set created_at = now() - interval '3 days';

-- account + storefront ages
${creators.map((c, i) => `update public.creators set created_at = now() - interval '${75 + ((i * 17) % 110)} days', published_at = case when status = 'published' then now() - interval '${70 + ((i * 17) % 100)} days' end, approved_at = case when status = 'published' then now() - interval '${70 + ((i * 17) % 100)} days' end where id = ${q(c.id)};`).join('\n')}
update public.creators set created_at = now() - interval '2 days' where status = 'pending_review';
${brands.map((b, i) => `update public.brands set created_at = now() - interval '${80 + i * 9} days' where id = ${q(b.id)};`).join('\n')}
update public.profiles p set created_at = coalesce((select created_at from public.creators c where c.profile_id = p.id), (select created_at from public.brands b where b.profile_id = p.id), now() - interval '200 days');
update auth.users u set created_at = p.created_at from public.profiles p where p.id = u.id;

-- audit events follow the entities they describe
update public.audit_logs a set created_at = o.updated_at from public.orders o where a.entity_type = 'order' and a.entity_id = o.id::text;
update public.audit_logs a set created_at = coalesce(p.captured_at, p.created_at) from public.payments p where a.entity_type = 'payment' and a.entity_id = p.id::text;
update public.audit_logs a set created_at = c.last_message_at from public.conversations c where a.entity_type = 'conversation' and a.entity_id = c.id::text and c.last_message_at is not null;
update public.audit_logs a set created_at = p.created_at from public.profiles p where a.action = 'profile_created' and a.entity_id = p.id::text;
update public.audit_logs a set created_at = pr.updated_at from public.payout_requests pr where a.entity_type = 'payout_request' and a.entity_id = pr.id::text;

alter table public.profiles enable trigger profiles_audit_changes;
alter table public.creators enable trigger creators_audit_changes;
alter table public.brands enable trigger brands_audit_changes;
-- Demo notifications are historical, so nothing should be emailed for them.
-- Without this a fresh db reset would queue hundreds of messages to the
-- fake @spotlit.demo addresses the moment a provider is configured.
update public.email_deliveries set status = 'skipped', last_error = 'seed data' where status = 'pending';

commit;
`)

fs.writeFileSync(OUT, out.join('\n') + '\n')
console.log(`wrote ${path.relative(root, OUT)} — ${creators.length} creators, ${brands.length} brands, ${orderDefs.length} orders, ${mIdx} dialog messages`)
