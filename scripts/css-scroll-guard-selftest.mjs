/**
 * Prove every assertion in css-scroll-check.mjs actually fails when its rule is broken.
 *
 * The guard was written, reported OK, and was wrong: two of its lookups required the selector to contain a `{`,
 * which the rule parser strips, so those assertions never ran. A check that cannot fail is not evidence, so each
 * assertion is now planted with its defect and required to fail.
 *
 *   node scripts/css-guard-selftest.mjs   (the backtick self-test lives in css-guard-selftest.mjs)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const clientPath = join(root, 'lib', 'client.js')
const guardPath = join(root, 'scripts', 'css-scroll-check.mjs')
const original = readFileSync(clientPath, 'utf8')

/** Run the guard and report whether it failed, which is what it must do with a defect present. */
function guardFails() {
  try {
    execFileSync(process.execPath, [guardPath], { stdio: 'pipe' })
    return false
  } catch {
    return true
  }
}

const plants = [
  {
    name: 'a viewport unit in the drawer',
    from: 'padding: 12px 14px; overflow-x: auto;',
    to: 'padding: 12px 14px; overflow: auto; max-height: 60vh;',
  },
  {
    name: 'a nested vertical scroller in the drawer',
    from: 'padding: 12px 14px; overflow-x: auto;',
    to: 'padding: 12px 14px; overflow: auto;',
  },
  {
    name: 'a body that will not scroll',
    from: '.sm-insp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 20px; }',
    to: '.sm-insp-body { flex: 1; min-height: 0; overflow-y: visible; padding: 20px; }',
  },
  {
    name: 'a body that can grow instead of scrolling',
    from: '.sm-insp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 20px; }',
    to: '.sm-insp-body { flex: 1; overflow-y: auto; padding: 20px; }',
  },
  {
    name: 'a shrinkable header',
    from: 'padding: 20px 20px 0; flex: 0 0 auto;',
    to: 'padding: 20px 20px 0;',
  },
  {
    name: 'a drawer that is not a column',
    from: 'display: flex; flex-direction: column;\n}\n[data-skill-market] .sm-inspector.open',
    to: 'display: flex; flex-direction: row;\n}\n[data-skill-market] .sm-inspector.open',
  },
  {
    name: 'a panel that sizes against its mount instead of the viewport',
    from: 'height: 100vh; height: 100dvh; max-height: 100%; min-height: 0; flex: 1 1 auto;',
    to: 'height: 100%; max-height: 100%; min-height: 0; flex: 1 1 auto;',
  },
  {
    name: 'a panel with no dvh override',
    from: 'height: 100vh; height: 100dvh; max-height: 100%; min-height: 0; flex: 1 1 auto;',
    to: 'height: 100vh; max-height: 100%; min-height: 0; flex: 1 1 auto;',
  },
  {
    name: 'a panel with no scroll backstop',
    from: 'position: relative; overflow: hidden; overflow-y: auto;',
    to: 'position: relative; overflow: hidden;',
  },
]

let failures = 0
// The guard must pass on the untouched stylesheet first, or every plant below proves nothing.
if (guardFails()) {
  console.error('  FAIL: the guard already fails on the unmodified stylesheet')
  process.exit(1)
}
console.log('  ok   the guard passes on the unmodified stylesheet')

for (const plant of plants) {
  if (original.includes(plant.from) === false) {
    console.error(`  FAIL: anchor not found for "${plant.name}" — this self-test needs updating`)
    failures += 1
    continue
  }
  writeFileSync(clientPath, original.replace(plant.from, plant.to), 'utf8')
  const caught = guardFails()
  writeFileSync(clientPath, original, 'utf8')
  console.log(`  ${caught ? 'ok  ' : 'FAIL'} the guard catches ${plant.name}`)
  if (caught === false) failures += 1
}

writeFileSync(clientPath, original, 'utf8')
console.log('')
if (failures === 0) {
  console.log(`  SCROLL GUARD SELF-TEST OK — all ${String(plants.length)} defects were caught`)
  process.exit(0)
}
console.log(`  ${String(failures)} defect(s) went undetected`)
process.exit(1)
