// Runs supabase/tests/*.test.sql against a database that has the migrations
// applied (e.g. `supabase start` → postgresql://postgres:postgres@127.0.0.1:54322/postgres).
// Each file runs in its own session and rolls back — no data is left behind.
//
//   DATABASE_URL=postgresql://... npm run db:test
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'supabase', 'tests')
const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const filter = process.argv[2]

function load(file) {
  const raw = fs.readFileSync(file, 'utf8')
  return raw.replace(/^--\s*@include\s+(\S+)\s*$/gm, (_, inc) => fs.readFileSync(path.join(path.dirname(file), inc), 'utf8'))
}

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.test.sql') && (!filter || f.includes(filter)))
  .sort()

let failed = 0
for (const f of files) {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  const started = Date.now()
  try {
    await client.query(load(path.join(dir, f)))
    console.log(`✓ ${f} (${Date.now() - started} ms)`)
  } catch (e) {
    failed++
    console.error(`✗ ${f}\n  ${e.message}${e.where ? `\n  where: ${e.where}` : ''}`)
    await client.query('rollback').catch(() => undefined)
  } finally {
    await client.end()
  }
}
console.log(failed ? `\n${failed} of ${files.length} test file(s) failed` : `\nAll ${files.length} test files passed`)
process.exit(failed ? 1 : 0)
