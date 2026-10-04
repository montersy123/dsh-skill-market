/**
 * Report which upstream release an installed skill's files actually match.
 *
 * Compares every file's sha256 against the listing for each candidate version, so the
 * answer comes from the bytes on disk rather than from a recorded label. This is the
 * check that tells "the old version reverted" apart from "the label says old but the
 * files are new" — two very different bugs.
 *
 *   node tools/which-version.mjs <handle> <slug> [version...]
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const handle = process.argv[2] ?? 'indiv-ebandao'
const slug = process.argv[3] ?? 'dev-expert'
const directory = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skills', `${handle}--${slug}`)

console.log('directory:', directory)
console.log('exists   :', existsSync(directory))
if (!existsSync(directory)) process.exit(1)

const instruction = readFileSync(join(directory, 'SKILL.md'), 'utf8')
// Frontmatter only, and still only a hint: a `version:` line in the body is prose, and the
// field itself cannot be trusted — upstream ships packages whose field names a different
// release than their files. The hash comparison below is the answer; this line is context.
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(instruction)
const declared = frontmatter === null
  ? undefined
  : /^version:\s*(.+)$/m.exec(frontmatter[1])?.[1]?.trim().replace(/^["']|["']$/g, '')
console.log('SKILL.md declares version:', JSON.stringify(declared))

/** Candidate versions: the ones named, else the newest few upstream publishes. */
let candidates = process.argv.slice(4)
if (candidates.length === 0) {
  const versions = await (await fetch(`https://api.skillhub.cn/api/v1/skills/${slug}/versions?namespace=${handle}`)).json()
  candidates = (versions?.versions ?? []).slice(0, 5).map((entry) => String(entry.version))
  console.log('candidates (newest upstream):', candidates.join(', '))
}

for (const version of candidates) {
  const listing = await (await fetch(`https://api.skillhub.cn/api/v1/skills/${slug}/files?namespace=${handle}&version=${version}`)).json()
  if (!Array.isArray(listing?.files)) { console.log(`  v${version}: no listing`); continue }
  let match = 0
  let differ = 0
  let missing = 0
  for (const entry of listing.files) {
    const path = join(directory, ...String(entry.path).split('/'))
    if (!existsSync(path)) { missing += 1; continue }
    const sha = createHash('sha256').update(readFileSync(path)).digest('hex')
    if (sha === entry.sha256) match += 1
    else differ += 1
  }
  const total = listing.files.length
  console.log(`  v${version}: ${match}/${total} match, ${differ} differ, ${missing} missing`
    + (match === total ? '   <-- EXACT MATCH' : ''))
}
