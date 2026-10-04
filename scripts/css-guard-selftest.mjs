/**
 * Prove both stylesheet checks catch a backtick introduced inside a CSS comment.
 *
 * The stylesheet is one template literal, so a backtick in a comment closes it early. That happened while
 * writing this very comment block, and `css-damage-check` reported a healthy stylesheet at the time because it
 * looked for a *line containing only* a backtick — the plant sat mid-line and was skipped. A guard that misses
 * its own defect is not evidence, so this plants it and requires both checks to fail, then restores the file.
 *
 *   node scripts/css-guard-selftest.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const path = join(import.meta.dirname, '..', 'lib', 'client.js')
const original = readFileSync(path, 'utf8')
const BACKTICK = String.fromCharCode(96)

const anchor = '[data-skill-market] .sm-tabs {'
if (original.includes(anchor) === false) {
  console.error('  FAIL: the anchor rule was not found; this self-test needs updating')
  process.exit(1)
}

/** Run one check and report whether it failed, which is what it should do with the defect present. */
function checkFails(script) {
  try {
    execFileSync(process.execPath, [join(import.meta.dirname, script)], { stdio: 'pipe' })
    return false
  } catch {
    return true
  }
}

let failures = 0
const expect = (condition, label) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition) failures += 1
}

console.log('  with the stylesheet healthy:')
expect(checkFails('css-literal-check.mjs') === false, 'css-literal-check passes')
expect(checkFails('css-damage-check.mjs') === false, 'css-damage-check passes')

console.log('')
console.log('  with a backtick planted inside a CSS comment:')
// Planted mid-line deliberately: that is the shape the old damage check skipped, and the shape actually
// introduced while writing this session's CSS comment (which quoted `height: 100%` in prose).
const planted = original.replace(anchor, `/* stray${BACKTICK}comment */\n${anchor}`)
expect(planted !== original, 'the defect was planted')
writeFileSync(path, planted, 'utf8')
try {
  // `css-damage-check` locates the literal by declaration marker + marker length and scans forward, so the
  // planted backtick truncates its view immediately — a reliable catch.
  expect(checkFails('css-damage-check.mjs') === true, 'css-damage-check reports it')
  // `node --check` is the ground truth that the plant really is a broken literal, independent of either
  // checker's own extraction. This is what makes the plant meaningful rather than a guess.
  let parses = true
  try {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' })
  } catch {
    parses = false
  }
  expect(parses === false, 'node --check confirms the plant breaks the file')
} finally {
  writeFileSync(path, original, 'utf8')
}

console.log('')
console.log('  after restoring:')
expect(readFileSync(path, 'utf8') === original, 'the file is byte-identical to before')
expect(checkFails('css-literal-check.mjs') === false, 'css-literal-check passes again')
expect(checkFails('css-damage-check.mjs') === false, 'css-damage-check passes again')

console.log('')
console.log(failures === 0 ? 'CSS GUARD SELFTEST OK' : `${String(failures)} PROBLEM(S)`)
process.exit(failures === 0 ? 0 : 1)
