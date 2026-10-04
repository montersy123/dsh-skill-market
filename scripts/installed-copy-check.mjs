/**
 * Report whether the installed plugin copy carries the current source.
 *
 * Written as a file because inline `node -e` through PowerShell keeps mangling quotes — several
 * checks in this session silently returned wrong answers for that reason, which is worse than
 * failing outright.
 *
 *   node tools/installed-copy-check.mjs
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { findRemainingChinese } from './i18n-remaining.mjs'

const pkg = join(
  process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  'profiles', process.env.DSH_PROFILE ?? 'desktop',
  'node_modules', '@montersy123', 'dsh-skill-market',
)

/** Assertions, each a short name and a predicate over the installed source. */
const checks = [
  ['client matches source', (host, client) => client === readFileSync('lib/client.js', 'utf8')],
  ['host matches source', (host) => host === readFileSync('lib/index.js', 'utf8')],
  ['creates the state tree', (host) => host.includes('ensureStateTree')],
  ['no longer prunes state', (host) => host.includes('pruneEmptyDataRoot') === false],
  ['state dir is the package name', (host) => host.includes("'@montersy123-dsh-skill-market'")],
  // These assertions used to match the Chinese text a control rendered, which stopped being a source
  // literal once the panel was translated. They now match the *key* the control renders through, which is
  // the invariant that actually matters: the string moved from the component into the dictionary, and the
  // component must still be the thing that produces it.
  ['uninstall asks first', (host, client) => client.includes("t('action.uninstallBody')")],
  ['confirmation is the panel dialog', (host, client) => client.includes('function ConfirmDialog')],
  ['no native confirm left', (host, client) => client.includes('typeof window.confirm') === false],
  ['install confirms downgrades', (host, client) => client.includes("t('action.downgrade'")],
  // A local row must hide the download count, and a hand-placed (`manual`) row must not: a manual
  // directory can still have a catalogue record, and then its count is real. This assertion
  // distinguishes the two origins inside the download condition specifically.
  ['local rows hide downloads', (host, client) => {
    const condition = client.slice(client.indexOf("entry.origin === 'local' || Number(skill?.installs"))
    return condition.slice(0, 60).includes("entry.origin === 'local'") && condition.slice(0, 60).includes('manual') === false
  }],
  ['view is not persisted', (host, client) => client.includes('view: state.view') === false],
  ['opens on 发现', (host, client) => client.includes("view: 'market',")],
  ['search placeholder set', (host, client) => client.includes("t('search.placeholder')")],
  ['overview no longer inlines SKILL.md', (host, client) => client.includes('sm-md-frame') === false],
  ['overview has no files-tab hint', (host, client) => client.includes('技能正文在') === false],
  ['file preview splits frontmatter', (host, client) => client.includes('function MarkdownFile')],
  ['the view bar precedes the scroll body', (host, client) => {
    const viewbarAt = client.indexOf("h('div', { className: 'sm-viewbar' }")
    const contentAt = client.indexOf("h('main', { className: 'sm-content'")
    return viewbarAt > 0 && contentAt > 0 && viewbarAt < contentAt
  }],
  // The structural defect itself — `div.sm-viewbar` nested inside `header.sm-topbar` — is asserted on the
  // rendered DOM by render-panel's `landmarkOrder`, and that guard has its own self-test against synthetic
  // DOMs. A source-text brace count was tried here and got the arithmetic wrong, which is exactly why the
  // rendered tree is the right place for this claim.
  // The panel must be translated through one entry point, and the dictionaries must be inside the bundle
  // because a client bundle cannot require a sibling file at runtime.
  ['client translates through one function', (host, client) => client.includes('function t(key, params)')],
  ['client carries its own dictionaries', (host, client) => client.includes('const ZH = {') && client.includes('const EN = {')],
  ['client binds the locale service', (host, client) => client.includes('ctx.locale.bind(CLIENT_NS)')],
  // Reuses the one implementation of "what is still untranslated" rather than a second, subtly different
  // one; two answers to that question would eventually disagree.
  ['no hardcoded Chinese left in the panel', () => findRemainingChinese().strings.length === 0],
]

const host = readFileSync(join(pkg, 'lib', 'index.js'), 'utf8')
const client = readFileSync(join(pkg, 'lib', 'client.js'), 'utf8')

console.log('installed copy:', pkg)
let failed = 0
for (const [name, predicate] of checks) {
  let ok = false
  try { ok = predicate(host, client) === true } catch (error) { ok = false; void error }
  if (ok === false) failed += 1
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`)
}
console.log(failed === 0 ? '\nINSTALLED COPY OK' : `\n${failed} CHECK(S) FAILED`)
process.exit(failed === 0 ? 0 : 1)
