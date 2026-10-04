/**
 * Find relative paths in the moved scripts that no longer resolve.
 *
 * The mechanical rewrite fixed the package prefix but left two things wrong: a `..` depth that was correct from
 * `scripts/` and is wrong from `scripts/dev/`, and fixture paths that kept pointing at `scripts/` instead of
 * `tests/`. Rather than reasoning about each case, this resolves every string that looks like a project path and
 * reports the ones whose target does not exist.
 *
 *   node scripts/check-script-paths.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

/** Every `.mjs` under `scripts/`, at any depth. */
function scriptsUnder(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { scriptsUnder(path, out); continue }
    if (name.endsWith('.mjs')) out.push(path)
  }
  return out
}

// Only paths that point at something we own. Third-party or generated locations are not checked, and a path
// containing a wildcard or a template placeholder is skipped because it cannot be resolved literally.
const OWNED = /(^|\/)(lib|locale|tests|docs)\//.source

const problems = []
const files = scriptsUnder(join(root, 'scripts'))
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const dir = dirname(file)
  const relatives = new Set()

  // String literals that look like a project path.
  for (const match of source.matchAll(/['"`](\.{1,2}\/[^'"`\n]+)['"`]/g)) relatives.add(match[1])
  // `join(import.meta.dirname, '..', 'lib', 'x.js')` and friends.
  for (const match of source.matchAll(/join\(\s*import\.meta\.dirname\s*,([^)]*)\)/g)) {
    const parts = [...match[1].matchAll(/'([^']*)'/g)].map((piece) => piece[1])
    if (parts.length === 0) continue
    if (parts.some((part) => part.includes('${'))) continue
    relatives.add(join(...parts))
  }

  for (const relative of relatives) {
    if (new RegExp(OWNED).test(relative) === false && relative.includes('import.meta') === false) {
      // Also check a bare `lib/...` or `tests/...`, which resolves from the process working directory.
      if (/^(lib|locale|tests|docs)\//.test(relative) === false) continue
    }
    if (relative.includes('*')) continue
    const target = relative.startsWith('.')
      ? resolve(dir, relative)
      : resolve(root, relative)
    if (existsSync(target)) continue
    problems.push({ file: file.replace(`${root}\\`, '').replace(`${root}/`, ''), relative })
  }
}

console.log(`  ${String(files.length)} script(s) scanned`)
console.log(`  ${String(problems.length)} path(s) do not resolve`)
console.log('')
for (const problem of problems) console.log(`    ${problem.file}  ->  ${problem.relative}`)
process.exit(problems.length === 0 ? 0 : 1)
