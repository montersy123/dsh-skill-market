/**
 * Repair the last of the GBK round-trip damage in
 * `lib/index.js`.
 *
 * The earlier passes restored most runs. What remains are lines where the absorbed
 * byte left a marker (`?`) that has to become the byte it replaced, plus the em
 * dashes. The Chinese itself is rebuilt from `\u` escapes rather than typed
 * literally, because typing the damaged bytes by hand is what kept going wrong.
 *
 * Only the lines still carrying a damage marker are touched. Each replacement is
 * asserted to occur exactly once.
 *
 *   node tools/repair-host.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const TARGET = 'lib/index.js'
const apply = process.argv.includes('--apply')

/** One bad line -> its correct text. Keyed by the line's stable ASCII prefix. */
const REPAIRS = [
  // ── error messages: the closing delimiter was absorbed ────────────────────
  ["if (name === '' || name.length > 128) throw", `  if (name === '' || name.length > 128) throw new Error('\u6280\u80fd\u540d\u957f\u5ea6\u4e0d\u5408\u6cd5')`],
  ['if (raw.startsWith', '  if (raw.startsWith(\'/\') || raw.startsWith(\'\\\\\') || /^[A-Za-z]:/.test(raw)) throw new Error(`\u62d2\u7edd\u7edd\u5bf9\u8def\u5f84\uff1a${raw}`)'],
  ['if (slug === \'\' || namespace === \'\') throw', '  if (slug === \'\' || namespace === \'\') throw new Error(\'\u5b89\u88c5\u8bf7\u6c42\u7f3a\u5c11 slug \u6216 namespace\')'],
  ['if (files.length === 0) throw', `  if (files.length === 0) throw new Error('\u8be5\u6280\u80fd\u6ca1\u6709\u53ef\u4e0b\u8f7d\u7684\u6587\u4ef6')`],
  ['if (totalBytes > MAX_TOTAL_BYTES) throw', `      if (totalBytes > MAX_TOTAL_BYTES) throw new Error('\u6280\u80fd\u4f53\u79ef\u8d85\u51fa\u4e0a\u9650\uff0c\u5df2\u4e2d\u6b62\u5b89\u88c5')`],
  ['if (actual !== declaredHash) throw', '        if (actual !== declaredHash) throw new Error(`\u6587\u4ef6\u6821\u9a8c\u5931\u8d25\uff08sha256 \u4e0d\u4e00\u81f4\uff09\uff1a${filePath}`)'],
  ['if (!resolve(dir).startsWith(resolve(root) + sep)) throw', `    if (!resolve(dir).startsWith(resolve(root) + sep)) throw new Error('\u62d2\u7edd\u8d8a\u754c\u7684\u5378\u8f7d\u8def\u5f84')`],
  ['if (size > 64 * 1024) throw', `    if (size > 64 * 1024) throw new Error('\u8bf7\u6c42\u4f53\u8fc7\u5927')`],
  // ── template literals: `${` and the closing backtick were absorbed ────────
  ['    throw new Error(`', '    throw new Error(`\u62d2\u7edd\u8d8a\u754c\u8def\u5f84\uff1a${raw}`)'],
  ['    throw new Error(`', '    throw new Error(`\u6587\u4ef6\u8fc7\u5927\uff08${Math.round(declaredSize / 1024)} KB\uff09\uff1a${filePath}`)'],
  ['  if (bytes.byteLength > MAX_FILE_BYTES) throw', '  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`\u6587\u4ef6\u8fc7\u5927\uff08${bytes.byteLength} \u5b57\u8282\uff09\uff1a${filePath}`)'],
  // ── messages that kept their Chinese but lost the tail ────────────────────
  ['无法被 Harness 识别', `    throw new Error('\u8be5\u6280\u80fd\u5305\u7f3a\u5c11 SKILL.md\uff0c\u65e0\u6cd5\u88ab Harness \u8bc6\u522b\u4e3a\u6280\u80fd')`],
  ['缺少 name', `    throw new Error('\u8be5\u6280\u80fd\u7684 SKILL.md \u7f3a\u5c11 name \u6216 description\uff0c\u65e0\u6cd5\u88ab Harness \u8bc6\u522b')`],
  // ── sendError with a mangled verb ─────────────────────────────────────────
  ['sendError(res, 405,', `    sendError(res, 405, '\u53ea\u652f\u6301 GET \u4e0e POST \u8bf7\u6c42')`],
  // ── em dashes in prose ────────────────────────────────────────────────────
  ['* dsh-skill-market ', ' * dsh-skill-market \u2014 Host half.'],
  ['*     alternative ', ' *     alternative \u2014 a *provider*, whose catalog is only re-read when something'],
  ['*     calls its `invalidate()`', ' *     calls its `invalidate()` \u2014 looks equivalent but is not: in a profile with no'],
  ['* Using the stock root makes', ' * Using the stock root makes an installed skill an ordinary local skill \u2014 the'],
  ['* 鈥', ' * \u2014 flat, with no plugin-specific wrapper directory.'],
  ['* that carries a malformed object fails', ' * that carries a malformed object fails candidate validation \u2014 and that failure'],
  ['* inside the destination', ' * inside the destination \u2014 the running Harness may have the current `SKILL.md`'],
  ['* own provider. The state file is gone now', ' * own provider. The state file is gone now \u2014 location is the state \u2014 so anything'],
  ['* genuinely unreadable', ' * genuinely unreadable \u2014 not merely absent from this plugin\'s catalog. That'],
  ['// `validateDefinition` rejects a missing one', '      // `validateDefinition` rejects a missing one \u2014 so it is passed explicitly.'],
  ['*  - `complete` / `skills`', ' *  - `complete` / `skills` \u2014 what the shared `ctx.skills` registry sees. The'],
  ['*  - `mySkills`', ' *  - `mySkills` \u2014 what *this* plugin scanned and registered from disk, with its'],
  ['* session would actually see', ' * session would actually see \u2014 including that disabling a skill withdraws it.'],
]

const lines = readFileSync(TARGET, 'utf8').split('\n')
const used = new Set()
const changed = []

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index]
  if (!/[\u4E00-\u9FFF]\?|\u9225|\uFFFD/.test(line)) continue
  const candidates = REPAIRS.filter(([prefix]) => line.trim().startsWith(prefix.trim()) || line.includes(prefix))
  if (candidates.length === 0) {
    changed.push({ line: index + 1, before: line, after: null })
    continue
  }
  const [prefix, replacement] = candidates[0]
  used.add(prefix)
  lines[index] = replacement
  changed.push({ line: index + 1, before: line, after: replacement })
}

const text = lines.join('\n')
const leftovers = [...new Set([...text.matchAll(/[\u4E00-\u9FFF]\?|\u9225|\uFFFD/g)].map((m) => m[0]))]
const unreplaced = changed.filter((entry) => entry.after === null)

console.log(`damaged lines: ${changed.length} | repaired: ${changed.length - unreplaced.length}`)
for (const entry of changed) {
  console.log(`  ${entry.line}: ${entry.before.trim().slice(0, 80)}`)
  if (entry.after === null) console.log('      !! no repair pattern matched')
}
console.log('unused patterns:', REPAIRS.length - used.size)
console.log('leftover markers:', leftovers.length === 0 ? 'none' : JSON.stringify(leftovers))

if (leftovers.length > 0 || unreplaced.length > 0) {
  console.error('refusing to write')
  process.exit(1)
}
if (!apply) {
  console.log('(dry run; pass --apply to write)')
  process.exit(0)
}
writeFileSync(TARGET, text, 'utf8')
console.log(`wrote ${TARGET}`)
