// Natural-language marketplace search → structured filters. The client then
// queries `search_creators` with them. Parsers are pluggable: register an AI
// implementation of `SmartSearchParser` here (keys stay in Edge Function env).
import { handler, HttpError, json, readJson } from '../_shared/http.ts'
import { ruleBasedParser, type SmartSearchParser } from '../_shared/smart-search-parser.ts'

const parsers: Record<string, SmartSearchParser> = {
  rules: ruleBasedParser,
}

function activeParser(): SmartSearchParser {
  const name = (Deno.env.get('SMART_SEARCH_PROVIDER') ?? 'rules').toLowerCase()
  return parsers[name] ?? ruleBasedParser
}

export const handle = handler(async (req) => {
  let query = ''
  if (req.method === 'GET') query = new URL(req.url).searchParams.get('q') ?? ''
  else if (req.method === 'POST') query = String((await readJson<{ query?: unknown }>(req)).query ?? '')
  else throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')

  query = query.trim()
  if (query.length > 300) throw new HttpError(400, 'Search is too long (300 characters max).', 'QUERY_TOO_LONG')

  let result
  try {
    result = await activeParser().parse(query)
  } catch (e) {
    console.error('smart-search parser failed, using rules', e)
    result = await ruleBasedParser.parse(query)
  }
  return json(result, 200, { 'Cache-Control': 'public, max-age=60' })
})
