/**
 * Confirm which categories the registry accepts, from its own source rather than from the prose list.
 *
 * The contributing guide lists categories in prose, but the checker holds the authoritative array, and a wrong
 * category is a CI failure. Prints the array and whether the categories this project is choosing between are in it.
 */
import { readFileSync } from 'node:fs'

const source = readFileSync(process.argv[2], 'utf8')
const match = source.match(/CAT_IDS = \[[^\]]*\]/)
if (match === null) {
  console.error('  FAIL: CAT_IDS not found')
  process.exit(1)
}

const categories = match[0]
  .replace('CAT_IDS = ', '')
  .replace(/[[\]']/g, '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value !== '')

console.log(`  ${String(categories.length)} categories accepted`)
console.log(`  ${categories.join(', ')}`)
console.log('')
for (const wanted of ['skill', 'market', 'tools', 'ui', 'dev']) {
  console.log(`  ${categories.includes(wanted) ? 'ok  ' : 'no  '} ${wanted}`)
}
