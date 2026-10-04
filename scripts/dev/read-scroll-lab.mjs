/**
 * Print the measurement block that build-scroll-lab.mjs's page writes into the DOM.
 *
 * Chrome's `--dump-dom` returns the serialized document, so the numbers arrive as escaped text inside a `pre`.
 * Reading them here keeps the shell out of the way, which has mangled inline scripts repeatedly in this project.
 *
 *   node scripts/dev/read-scroll-lab.mjs <dump.html>
 */
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (path === undefined) {
  console.error('  usage: node scripts/dev/read-scroll-lab.mjs <dump.html>')
  process.exit(1)
}

const html = readFileSync(path, 'utf8')
const match = /<pre id="measure">([\s\S]*?)<\/pre>/.exec(html)
if (match === null) {
  console.error('  the measurement block is not in the dump — the page script did not run')
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)
  console.error(`  document length: ${String(html.length)}${title === null ? '' : `, title: ${title[1]}`}`)
  process.exit(1)
}

const text = match[1]
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')

for (const line of text.split('\n')) console.log(`  ${line}`)
