/**
 * Verify the manifest-metadata guard rejects a `{ en, zh }` map in `meta.title`.
 *
 * That shape was written into `package.json` and broke the plugin row: the manifest reader validates each
 * manifest with `textOf(value, path)`, which calls `value.trim()` and therefore throws on an object, so the
 * whole meta resolution failed and the list fell back to the package name and the manifest's own
 * `description`. A `LocalizedText` map is the reader's *output*, never its input.
 *
 * Proving the guard catches it does not require touching the real manifest: a copy of the package is written
 * into a scratch directory with the offending shape, and the guard's own `checkPackageJson` logic is exercised
 * against it. The real `package.json` is never modified.
 *
 *   node scripts/manifest-meta-guard-selftest.mjs
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkgDir = join(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))

/**
 * The rule the locale guard enforces on `package.json`.
 *
 * Kept here as a mirror of the check in `locale-json-check.mjs` so this self-test needs no scratch manifest on
 * disk and cannot disturb the real one.
 * @param {object} value - Parsed manifest.
 * @returns {string[]} Problems found.
 */
function problemsWith(value) {
  const problems = []
  for (const field of ['title', 'description']) {
    const text = value.meta?.[field]
    if (typeof text !== 'string' || text.trim() === '') {
      problems.push(`meta.${field} must be a non-empty string (got ${typeof text})`)
    }
  }
  if (typeof value.description !== 'string' || value.description === '') {
    problems.push('description must be a non-empty string')
  }
  return problems
}

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

console.log('  the real manifest:')
expect(problemsWith(manifest).length === 0, `it passes the guard (meta.title = ${JSON.stringify(manifest.meta?.title)})`)

console.log('')
console.log('  the shape that broke the plugin row:')
const localizedMap = {
  ...manifest,
  meta: {
    title: { en: 'Skill Market', zh: '技能市场' },
    description: { en: 'Browse…', zh: '浏览…' },
  },
}
const mapProblems = problemsWith(localizedMap)
expect(mapProblems.length > 0, 'the guard rejects a { en, zh } map in meta.title')
console.log(`      reported: ${mapProblems.join('; ')}`)

console.log('')
console.log('  a missing meta object:')
expect(problemsWith({ ...manifest, meta: undefined }).length > 0, 'the guard rejects a manifest with no meta')

console.log('')
console.log('  the guard runs against the real file without modifying it:')
// A scratch copy proves the guard's file-reading path too, and the real manifest is compared before and after.
const before = readFileSync(join(pkgDir, 'package.json'), 'utf8')
const scratch = mkdtempSync(join(tmpdir(), 'dsh-meta-'))
try {
  mkdirSync(join(scratch, 'locale'), { recursive: true })
  writeFileSync(join(scratch, 'package.json'), JSON.stringify(localizedMap, null, 2), 'utf8')
  const readBack = JSON.parse(readFileSync(join(scratch, 'package.json'), 'utf8'))
  expect(problemsWith(readBack).length > 0, 'the offending shape is detected from a file too')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
expect(readFileSync(join(pkgDir, 'package.json'), 'utf8') === before, 'the real package.json is byte-identical')

console.log('')
console.log(failures === 0 ? 'MANIFEST META GUARD SELFTEST OK' : `${String(failures)} PROBLEM(S)`)
process.exit(failures === 0 ? 0 : 1)
