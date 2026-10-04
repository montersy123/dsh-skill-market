/**
 * Collect the translation keys the client panel asks for.
 *
 * ## Why a shape scan, and not a scan of `t(…)` calls
 *
 * The first version of this audit matched `t('…')` only, and six `tab.*` keys reached the screen as raw
 * text: they are defined in a table (`['overview', 'tab.overview']`) and translated later through a
 * variable, which no call-site scan can see. A span scanner for call arguments was then written, and it
 * proved worse — the file contains a large CSS template literal and English comments with apostrophes, and
 * either one desynchronised the scanner so that it swallowed ten thousand characters and reported a slot
 * name as a key. Three attempts, three sets of false answers.
 *
 * So the collection is a **shape scan** over every string literal in the code. It is deliberately strict
 * enough to be self-validating: each dot-separated segment must start with a lowercase letter and contain
 * no hyphen. That admits every real key (`tab.overview`, `card.install`, `misc.vendorKeen`) and rejects
 * every icon name (`i-arrow-up-circle`), class name (`sm-md-frame`) and media type (`application/json`),
 * because all of those contain a hyphen or a capitalised first segment. `i18n-keys-check.mjs` asserts both
 * directions on real examples, so the rule cannot silently stop matching.
 *
 * @module i18n-keys
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** A translation key: dot-separated, every segment starting lowercase, no hyphens. */
export const KEY_SHAPE = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/

/**
 * Key-shaped literals in the code that are deliberately **not** dictionary entries.
 *
 * Every entry needs a reason, because an unexplained one is how a real gap hides. `sidebar.panellist` is
 * the only one that had to be named: it is a slot id, and the strict shape rule cannot tell it apart from a
 * key. That is an accepted cost of the rule — one named exception is auditable, whereas a rule loose enough
 * to distinguish slot ids from keys is a rule that started returning wrong answers.
 */
export const NOT_KEYS = new Set([
  'sidebar.panellist',   // a slot id, passed to `ctx.slots.inject`, never to the translator
  'api.skillhub.cn',     // the upstream host shown in the status bar
])

/**
 * Remove comments and the generated dictionary block, keeping string literals intact.
 *
 * Cross-line block-comment state is tracked by walking the source rather than by dropping lines that start
 * with a marker. The file is more than half comments, and an apostrophe inside an English one
 * (`the skill's own record`) would otherwise be read as opening a string.
 *
 * @param {string} source - Client bundle source.
 * @returns {string} Code only.
 */
export function codeOnly(source) {
  const begin = source.indexOf('/* ── generated locale block')
  const end = source.indexOf('/* ── end generated locale block')
  const body = begin >= 0 && end > begin ? source.slice(0, begin) + source.slice(end) : source

  let out = ''
  let inBlockComment = false
  let quote = null
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    const next = body[index + 1]
    if (inBlockComment) {
      if (character === '*' && next === '/') { inBlockComment = false; index += 1 }
      continue
    }
    if (quote !== null) {
      out += character
      if (character === '\\') { out += next ?? ''; index += 1; continue }
      if (character === quote) quote = null
      continue
    }
    if (character === '/' && next === '/') {
      while (index < body.length && body[index] !== '\n') index += 1
      out += '\n'
      continue
    }
    if (character === '/' && next === '*') { inBlockComment = true; index += 1; continue }
    if (character === "'" || character === '"' || character === '`') { quote = character; out += character; continue }
    out += character
  }
  return out
}

/**
 * Every key the client asks the translator for.
 *
 * @param {string} clientSource - Client bundle source.
 * @returns {Set<string>} Referenced keys.
 */
export function collectKeys(clientSource) {
  const code = codeOnly(clientSource)
  const referenced = new Set()
  for (const match of code.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"/g)) {
    const value = match[1] ?? match[2] ?? ''
    if (KEY_SHAPE.test(value) === false) continue
    if (NOT_KEYS.has(value)) continue
    referenced.add(value)
  }
  return referenced
}

/** Read the client bundle and the dictionaries from the repository. */
export async function loadSources() {
  const pkg = join(import.meta.dirname, '..')
  const client = readFileSync(join(pkg, 'lib', 'client.js'), 'utf8')
  const dictionaries = await import(`file://${join(pkg, 'lib', 'locale.js').replace(/\\/g, '/')}`)
  return { client, ZH: dictionaries.ZH, EN: dictionaries.EN }
}
