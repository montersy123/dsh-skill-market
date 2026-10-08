/**
 * Remove one package's entries from a pnpm lock file.
 *
 * The profile declares four plugins that work and one dependency that was left behind by a half-finished uninstall.
 * `pnpm install` responds to the inconsistency by offering to purge and reinstall the whole modules directory, which
 * would rebuild the four working plugins to fix a stale line — a large risk for a small repair. This removes exactly
 * the stale entries instead, and prints what it removed so the change can be checked.
 *
 * Three places in a pnpm v9 lock file name a dependency, and all three must go together or the file is left
 * referring to a package that no longer exists:
 *   - `importers..dependencies`      the direct-dependency record
 *   - `packages`                     the resolved package
 *   - `snapshots`                    the resolved dependency graph
 *
 *   node scripts/dev/prune-lockfile-entry.mjs <lockfile> <packageName> [--apply]
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const [lockPath, name, ...flags] = process.argv.slice(2)
const apply = flags.includes('--apply')
if (lockPath === undefined || name === undefined) {
  console.error('  usage: node scripts/dev/prune-lockfile-entry.mjs <lockfile> <packageName> [--apply]')
  process.exit(1)
}

const original = readFileSync(lockPath, 'utf8')
const lines = original.split('\n')
const removed = []

/** Indentation of a line, in spaces. */
const indentOf = (line) => line.length - line.trimStart().length

/**
 * Delete a YAML block: the key line plus every following line that is more indented (or blank).
 * @param {number} keyIndex - Zero-based index of the key line.
 * @returns {number} How many lines were deleted.
 */
function blockLength(keyIndex) {
  const base = indentOf(lines[keyIndex])
  let end = keyIndex + 1
  while (end < lines.length) {
    const line = lines[end]
    if (line.trim() === '') {
      // A blank line belongs to the block only if a deeper line follows it.
      if (end + 1 < lines.length && lines[end + 1].trim() !== '' && indentOf(lines[end + 1]) > base) {
        end += 1
        continue
      }
      break
    }
    if (indentOf(line) <= base) break
    end += 1
  }
  const count = end - keyIndex
  removed.push({ keyIndex, count, head: lines[keyIndex].trim().slice(0, 90) })
  lines.splice(keyIndex, count)
  return count
}

// Walk backwards so earlier indices stay valid, and match the key at any depth: the two top-level sections use two
// spaces of indent, the importer entry uses eight.
for (let index = lines.length - 1; index >= 0; index -= 1) {
  const line = lines[index]
  if (line.includes(name) === false) continue
  // Only a key line starts a block to delete; a `version:` or `resolution:` line is part of one.
  if (/^\s*'?"?[^:]*'?:\s*(\{\}|.*)$/.test(line) === false) continue
  if (/^\s*(version|resolution|specifier|engines|dependencies|integrity):/.test(line)) continue
  blockLength(index)
}

console.log(`  lock file  : ${lockPath}`)
console.log(`  package    : ${name}`)
console.log('')
console.log(`  ${String(removed.length)} block(s) matched:`)
for (const entry of removed) console.log(`    ${String(entry.count)} line(s) at index ${String(entry.keyIndex)}: ${entry.head}`)
console.log('')
console.log(`  bytes      : ${String(Buffer.byteLength(original, 'utf8'))} -> ${String(Buffer.byteLength(lines.join('\n'), 'utf8'))}`)

const remaining = lines.filter((line) => line.includes(name)).length
console.log(`  remaining lines naming the package: ${String(remaining)}`)

if (apply === false) {
  console.log('')
  console.log('  (dry run; pass --apply to write)')
  process.exit(0)
}
if (remaining > 0) {
  console.error('')
  console.error('  FAIL: lines still name the package; refusing to write a partly pruned lock file')
  process.exit(1)
}
copyFileSync(lockPath, `${lockPath}.pre-prune`)
writeFileSync(lockPath, lines.join('\n'), 'utf8')
console.log('')
console.log(`  wrote ${lockPath} (previous copy kept as ${lockPath}.pre-prune)`)
