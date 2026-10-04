/**
 * Fetch a reference repository's LICENSE and report its exact shape.
 *
 * The licence is a legal document, so it is copied from the source rather than retyped, and its shape — whether
 * the copyright line is filled in, which year, what wording — is printed so the same form can be followed.
 *
 *   node scripts/dev/fetch-reference-license.mjs <owner/repo> [outFile]
 */
import { writeFileSync } from 'node:fs'

const repo = process.argv[2]
const out = process.argv[3] ?? ''
if (repo === undefined) {
  console.error('  usage: node scripts/dev/fetch-reference-license.mjs <owner/repo> [outFile]')
  process.exit(1)
}

for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
  const url = `https://raw.githubusercontent.com/${repo}/main/${name}`
  const response = await fetch(url)
  if (response.ok === false) {
    console.log(`  ${name}: HTTP ${String(response.status)}`)
    continue
  }
  const text = await response.text()
  const bytes = Buffer.byteLength(text, 'utf8')
  const lines = text.split('\n')
  console.log(`  ${name}: ${String(bytes)} bytes, ${String(lines.length)} lines`)
  console.log('')
  console.log('  --- full text ---')
  for (const line of lines) console.log(`  ${line}`)
  if (out !== '') {
    writeFileSync(out, text, 'utf8')
    console.log('')
    console.log(`  written to ${out}`)
  }
  break
}
