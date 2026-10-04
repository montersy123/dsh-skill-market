/**
 * Verify the plugin's locale JSON files by reading their bytes.
 *
 * PowerShell's output pipeline renders UTF-8 CJK as mojibake, so a "corrupted file" report from the console
 * cannot be trusted — this reads the raw bytes and decodes them explicitly, and prints the structure the
 * manifest reader expects (`meta.title` / `meta.description`, not top-level fields).
 *
 *   node scripts/locale-json-check.mjs
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const pkgDir = join(import.meta.dirname, '..')
const dir = join(pkgDir, 'locale')
const problems = []

// The manifest reader validates each manifest's `meta.title` and `meta.description` with `textOf`, which throws
// for anything that is not a non-empty string. A `LocalizedText`-shaped map (`{ en, zh }`) there is therefore
// not "bilingual metadata" — it makes the whole meta resolution fail, and the plugin list silently falls back
// to the package name as the title and the manifest's own `description` as the copy. That is exactly the
// regression this asserts against: the localized map is the reader's *output*, never its input.
const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
for (const field of ['title', 'description']) {
  const value = manifest.meta?.[field]
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`package.json meta.${field} must be a non-empty string (got ${JSON.stringify(value)}); a {en,zh} map throws in textOf and breaks all meta resolution`)
  }
}
if (typeof manifest.description !== 'string' || manifest.description === '') {
  problems.push('package.json description must be a non-empty string; it is the description fallback')
}

for (const name of ['en.json', 'zh.json']) {
  const path = join(dir, name)
  const bytes = readFileSync(path)
  console.log(`  ${'-'.repeat(72)}`)
  console.log(`  ${name}: ${String(bytes.length)} bytes`)
  console.log(`    BOM            : ${bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf}`)

  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    console.log('    valid UTF-8    : true')
  } catch (error) {
    problems.push(`${name} is not valid UTF-8 (${error.message})`)
    continue
  }

  // A lone replacement character means the bytes decoded but with loss, which is what a GBK round-trip leaves.
  if (text.includes('\uFFFD')) problems.push(`${name} contains U+FFFD, so it was re-encoded lossily`)

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    problems.push(`${name} is not valid JSON (${error.message})`)
    continue
  }

  // The reader takes `meta.title` and `meta.description`; a flat object yields undefined for both, and the
  // plugin list then falls back to package.json's own fields.
  const meta = parsed.meta
  console.log(`    top-level keys : ${JSON.stringify(Object.keys(parsed))}`)
  if (meta === undefined || typeof meta !== 'object') {
    problems.push(`${name} has no "meta" object, so its title and description are read as undefined`)
    continue
  }
  console.log(`    meta.title     : ${JSON.stringify(meta.title)}`)
  console.log(`    meta.description: ${JSON.stringify(meta.description)}`)
  if (typeof meta.title !== 'string' || meta.title === '') problems.push(`${name} meta.title is missing or not a string`)
  if (typeof meta.description !== 'string' || meta.description === '') problems.push(`${name} meta.description is missing or not a string`)

  // No provenance clause: the row introduces the feature, it does not cite where the UI came from.
  for (const banned of ['原型', 'prototype']) {
    if (text.includes(banned)) problems.push(`${name} still mentions the prototype ("${banned}")`)
  }
}

console.log(`  ${'-'.repeat(72)}`)
// The packed and installed copies must be byte-identical to the source. This is asserted because a GBK-shaped
// rendering of these files appeared in a console during development and was briefly believed to be file
// corruption; the bytes were always fine, and the console was misrepresenting them. A byte comparison is the
// only evidence that settles it.
const installedDir = join(
  process.env.DSH_PROFILE_DIR ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', 'desktop'),
  'node_modules', '@montersy123', 'dsh-skill-market', 'locale',
)
for (const name of ['en.json', 'zh.json']) {
  try {
    const sourceBytes = readFileSync(join(dir, name))
    const installedBytes = readFileSync(join(installedDir, name))
    if (Buffer.compare(sourceBytes, installedBytes) !== 0) {
      problems.push(`the installed ${name} differs from the source byte for byte`)
    }
  } catch (error) {
    // A missing installed copy is not a defect here: the check may run before the plugin is installed.
    console.log(`  installed ${name}: not installed yet (${error.code ?? error.message})`)
  }
}

// The two files must name the same thing, or switching language changes what the plugin is called.
const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8')).meta
const zh = JSON.parse(readFileSync(join(dir, 'zh.json'), 'utf8')).meta
console.log(`  en title: ${JSON.stringify(en?.title)}`)
console.log(`  zh title: ${JSON.stringify(zh?.title)}`)
console.log('')

if (problems.length === 0) {
  console.log('LOCALE JSON OK')
  process.exit(0)
}
for (const problem of problems) console.error('  FAIL ' + problem)
process.exit(1)
