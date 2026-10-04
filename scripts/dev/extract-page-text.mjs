/**
 * Extract the readable text of a saved HTML page, keeping headings and code blocks distinguishable.
 *
 * Used to read the plugin-publishing documentation without the site's navigation, which is most of the
 * page. Written as a file because an inline PowerShell one-liner mangles quotes and regexes badly
 * enough to produce wrong answers.
 *
 *   node scripts/extract-page-text.mjs <file.html> [startMarker]
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const startMarker = process.argv[3] ?? '两个概念'
const html = readFileSync(file, 'utf8')

// Strip everything that cannot contain article text first, so markers are not found inside scripts.
const withoutNoise = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')

const article = withoutNoise
  // Headings become markers so the structure survives.
  .replace(/<h([1-6])[^>]*>/gi, (_, level) => `\n\n${'#'.repeat(Number(level))} `)
  .replace(/<\/h[1-6]>/gi, '\n')
  .replace(/<li[^>]*>/gi, '\n- ')
  .replace(/<\/(p|div|li|tr|pre|blockquote)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<t[dh][^>]*>/gi, ' | ')
  .replace(/<[^>]+>/g, '')

const decoded = article
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
  .replace(/&hellip;/g, '…').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')

const lines = decoded.split('\n').map((line) => line.trimEnd())
const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()

const start = startMarker === '' ? 0 : text.indexOf(startMarker)
console.log(start < 0 ? text.slice(0, 12000) : text.slice(start, start + 16000))
