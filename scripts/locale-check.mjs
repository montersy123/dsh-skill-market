/**
 * Check the locale module's dictionaries for the faults that render as raw keys or wrong text.
 *
 * A translation gap is invisible in review: the panel simply shows `card.install` or falls back to
 * Chinese inside an English UI. This asserts the invariants the runtime does not — matching key sets,
 * matching placeholders, no empty values, and no key that only one locale knows about.
 *
 *   node scripts/locale-check.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EN, ZH, format, createTranslator } from '../lib/locale.js'

const failures = []
const zhKeys = Object.keys(ZH)
const enKeys = Object.keys(EN)

/** Placeholder names used by a template. */
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

console.log(`  zh keys: ${zhKeys.length}`)
console.log(`  en keys: ${enKeys.length}`)

const onlyZh = zhKeys.filter((key) => EN[key] === undefined)
const onlyEn = enKeys.filter((key) => ZH[key] === undefined)
if (onlyZh.length > 0) failures.push(`missing from en (${onlyZh.length}): ${onlyZh.slice(0, 12).join(', ')}`)
if (onlyEn.length > 0) failures.push(`missing from zh (${onlyEn.length}): ${onlyEn.slice(0, 12).join(', ')}`)

for (const key of zhKeys) {
  if (EN[key] === undefined) continue
  if (String(ZH[key]).trim() === '') failures.push(`empty zh value: ${key}`)
  if (String(EN[key]).trim() === '') failures.push(`empty en value: ${key}`)
  const zhPlaceholders = placeholders(ZH[key]).join(',')
  const enPlaceholders = placeholders(EN[key]).join(',')
  // A placeholder present in one language and absent in the other silently drops runtime data.
  if (zhPlaceholders !== enPlaceholders) {
    failures.push(`placeholder mismatch: ${key} — zh[${zhPlaceholders}] vs en[${enPlaceholders}]`)
  }
}

// The English dictionary must not still be Chinese: a copied value is the most likely slip.
const CJK = /[\u4e00-\u9fff]/
const untranslated = enKeys.filter((key) => CJK.test(String(EN[key])))
if (untranslated.length > 0) failures.push(`en still holds Chinese (${untranslated.length}): ${untranslated.slice(0, 12).join(', ')}`)

// Every key in the source file should exist: a key the code asks for but the dictionary lacks shows raw.
const duplicates = zhKeys.filter((key, index) => zhKeys.indexOf(key) !== index)
if (duplicates.length > 0) failures.push(`duplicate zh keys: ${duplicates.join(', ')}`)

// The fallback translator must never leak a raw key for anything in the dictionary.
const zhT = createTranslator('zh')
const enT = createTranslator('en')
const leaked = zhKeys.filter((key) => zhT(key) === key || enT(key) === key)
if (leaked.length > 0) failures.push(`dictionary entries that resolve to their own key: ${leaked.slice(0, 8).join(', ')}`)

// Placeholder substitution, including the deliberate case of a missing parameter.
if (format('a {x} b', { x: 'Y' }) !== 'a Y b') failures.push('format does not substitute')
if (format('a {x} b') !== 'a {x} b') failures.push('format should leave placeholders alone without params')
if (format('{a}{b}', { a: '1' }) !== '1{b}') failures.push('format should leave only the unknown placeholder')

// Every category key the captured fixture actually carries must have a translation. Category keys are
// easy to get wrong by guessing — `knowledge-management` is not `knowledge`, and `professional` has no
// relationship to `industry` — and a wrong key silently falls back to the upstream Chinese name inside
// an English UI.
const fixturePath = join(import.meta.dirname, '..', 'tests', 'fixture', 'skills.json')
try {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
  const realKeys = [...new Set((fixture.data?.skills ?? []).map((skill) => String(skill.category)))]
  const translated = new Set(zhKeys.filter((key) => key.startsWith('category.')).map((key) => key.slice('category.'.length)))
  const missing = realKeys.filter((key) => translated.has(key) === false)
  if (missing.length > 0) failures.push(`categories with no translation: ${missing.join(', ')}`)
  console.log(`  fixture categories covered: ${realKeys.length - missing.length}/${realKeys.length}`)
} catch (error) {
  failures.push(`could not check categories against the fixture: ${error.message}`)
}

console.log('')
for (const sample of ['card.install', 'view.discover', 'restart.effect', 'safety.badge', 'time.days']) {
  console.log(`  ${sample.padEnd(18)} zh=${JSON.stringify(zhT(sample, { count: 3 }))}  en=${JSON.stringify(enT(sample, { count: 3 }))}`)
}

console.log('')
if (failures.length === 0) {
  console.log('LOCALE OK')
  process.exit(0)
}
for (const failure of failures) console.error('  FAIL ' + failure)
console.error(`\n${failures.length} PROBLEM(S)`)
process.exit(1)
