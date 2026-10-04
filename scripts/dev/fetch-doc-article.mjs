/**
 * Fetch a documentation page and print its article text.
 *
 * The existing extractor mangles this site: its HTML carries variation selectors and the extraction re-encoded
 * them, producing text that is unusable either in a console or a file. Fetching and decoding explicitly as UTF-8,
 * then cutting the article element out, avoids the whole class of problem.
 *
 *   node scripts/dev/fetch-doc-article.mjs <url> [outFile]
 */
import { writeFileSync } from 'node:fs'

const url = process.argv[2]
const out = process.argv[3] ?? ''
if (url === undefined) {
  console.error('  usage: node scripts/dev/fetch-doc-article.mjs <url> [outFile]')
  process.exit(1)
}

const response = await fetch(url)
if (response.ok === false) throw new Error(`HTTP ${String(response.status)}`)
const html = await response.text()
console.log(`  fetched ${String(html.length)} characters`)

/**
 * Strip tags but keep block structure, so headings and list items stay on their own lines.
 * @param {string} fragment - HTML fragment.
 * @returns {string} Plain text.
 */
function toText(fragment) {
  return fragment
    // Script and style content is never prose.
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Block boundaries become newlines so headings and list items do not run together.
    .replace(/<\/(p|div|li|h[1-6]|tr|pre|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    // Entities that appear in code samples on this site.
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .filter((line, index, all) => line.trim() !== '' || (all[index - 1] ?? '').trim() !== '')
    .join('\n')
    .trim()
}

// The article sits in a `main`/`article` element on this site; fall back to the largest prose block.
const article = /<article[\s\S]*?<\/article>/i.exec(html)
  ?? /<main[\s\S]*?<\/main>/i.exec(html)
if (article === null) {
  console.error('  no article or main element found')
  process.exit(1)
}

const text = toText(article[0])
if (out !== '') {
  writeFileSync(out, text, 'utf8')
  console.log(`  wrote ${String(Buffer.byteLength(text, 'utf8'))} bytes to ${out}`)
} else {
  console.log('')
  console.log(text)
}
