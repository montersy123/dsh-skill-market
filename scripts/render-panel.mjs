/**
 * Render the skill-market panel inside jsdom with a stubbed `fetch`, then report
 * what the user would actually see: counts, the strings that reached the DOM,
 * any console error, and the result of scripted interactions.
 *
 *   node tools/render-panel.mjs --fixture <dir> [--react <node_modules>] [--viewport 390x844] [--interactions]
 *
 * The fixture directory holds `skills.json` and `categories.json` captured from
 * the live SkillHub API, so the smoke test exercises real record shapes without
 * touching the network. `PANEL_PAGE_URL` selects the page origin to simulate:
 * `http://127.0.0.1:19387/` for the browser build, `dsh-app://app/` for the
 * desktop shell.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const argv = process.argv.slice(2)
const flag = (name) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}
const fixtureDir = flag('--fixture')
const reactDir = flag('--react') ?? 'scripts/dev/reactsmoke/node_modules'
const viewport = flag('--viewport') ?? '1280x900'
const pageUrl = process.env.PANEL_PAGE_URL ?? 'http://127.0.0.1:19387/'
/**
 * Origin used for the persisted-state checks.
 *
 * `dsh-app://app/` is the real desktop origin, and it is exactly the origin whose
 * relative-URL resolution this harness exists to verify — but jsdom treats a custom
 * scheme as an opaque origin, where `localStorage` throws. So the render still uses
 * the requested URL while the storage round-trip runs against a placeholder copy of
 * the same document, under an origin jsdom can give a store.
 */
const storageUrl = pageUrl.startsWith('http') ? pageUrl : 'http://127.0.0.1:19387/'
const [width, height] = viewport.split('x').map(Number)

const thirdPartyRequire = createRequire(pathToFileURL(join(reactDir, 'package.json')).href)
const React = thirdPartyRequire('react')
const { JSDOM } = thirdPartyRequire('jsdom')

const skillsBody = readFileSync(join(fixtureDir, 'skills.json'), 'utf8')
const categoriesBody = readFileSync(join(fixtureDir, 'categories.json'), 'utf8')
const bundle = readFileSync('lib/client.js', 'utf8')

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', {
  url: pageUrl,
  pretendToBeVisual: true,
  // jsdom has no layout engine; the report says so explicitly.
})
const { window } = dom

// jsdom refuses `localStorage` on a custom scheme (an opaque origin), which is
// exactly the origin the desktop shell serves the page from. The real renderer is
// Chromium, where a registered scheme does have a store, so the panel's persistence
// is exercised here against a store borrowed from an http document. This keeps the
// requested page URL authoritative for the relative-URL and fetch checks.
if (pageUrl !== storageUrl) {
  const storeDom = new JSDOM('<!doctype html><html><body></body></html>', { url: storageUrl })
  Object.defineProperty(window, 'localStorage', {
    value: storeDom.window.localStorage,
    configurable: true,
  })
}

// React DOM resolves the ambient document from the globals, exactly as it does
// in a browser page, so jsdom's objects must be installed before it is required.
globalThis.window = window
globalThis.document = window.document
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.HTMLElement = window.HTMLElement
globalThis.Node = window.Node
globalThis.Event = window.Event
globalThis.MouseEvent = window.MouseEvent
globalThis.KeyboardEvent = window.KeyboardEvent
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = thirdPartyRequire('react-dom/client')
const { act } = thirdPartyRequire('react-dom/test-utils')

/**
 * Requests the panel made, with method and parsed body, so a test can assert on
 * the write side (install/uninstall) rather than only on renders.
 */
const requests = []
/**
 * How many skills the stub list endpoint claims in total, spread across pages of the
 * panel's own `pageSize`. Larger than one page on purpose: the lazy loader has to
 * append, and eventually reach an end.
 */
const PAGE_FIXTURE_TOTAL = 130
/** One line per list request, so a test can see which pages were fetched. */
const requestLog = []
/** Answer the Host would give to POST /install, keyed by the request's slug. */
const installAnswers = new Map()
/** Names the panel asked the Host to uninstall. */
const uninstallCalls = []
/** The install the stub Host most recently acknowledged, for later /enabled answers. */
let currentInstall = null
/**
 * The install the panel's ledger will claim on mount, so the stub `/installed` can
 * describe the same skill under its REAL path and the reconciliation assertion has
 * something to correct.
 */
const seedInstall = { slug: 'dev-expert', namespace: 'indiv-ebandao', name: 'dev-expert' }
/**
 * What the stub reports as the version on disk versus the version upstream publishes.
 * They differ on purpose: the update affordance cannot be tested without a gap, and
 * noticing that gap is the feature.
 */
const seedLocalVersion = '2.0.1'
const seedLatestVersion = '2.0.3'
/** Locally imported skills the stub Host claims to have on disk, in import order. */
const importedOnDisk = []
/** When true, the next `/import` is refused, so the failure path can be asserted. */
let importFails = false
/**
 * A skill the Host reports that this browser has never recorded.
 *
 * This is what a directory copied into the skill root by hand looks like from the panel's side:
 * present on disk, absent from `localStorage`. It must appear, and appear enabled.
 */
let handCopiedOnDisk = null
/** Every `/skill-security` query the panel made, as `<namespace>/<slug>`. */
const securityRequests = []

window.fetch = async (url, init = {}) => {
  const target = String(url)
  const method = init.method ?? 'GET'
  let parsedBody
  if (typeof init.body === 'string') {
    try { parsedBody = JSON.parse(init.body) } catch { parsedBody = init.body }
  }
  requests.push({ target, method, body: parsedBody })

  if (method === 'POST') {
    // A local import first: its body is the file itself and its name is a query parameter, so
    // it must be matched before the JSON install path below — which also returns for any POST
    // and would otherwise swallow it.
    if (target.includes('/import')) {
      const fileName = new URL(target, 'http://stub').searchParams.get('name') ?? ''
      const slug = String(fileName).replace(/\.(skill|zip|json|md)$/i, '') || 'imported-skill'
      if (importFails === true) {
        return { ok: false, status: 500, async json() { return { error: '技能包缺少 SKILL.md，无法被 Harness 识别为技能' } } }
      }
      importedOnDisk.push({ slug, version: '1.0.0', files: 3, bytes: 2048 })
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            import: {
              name: slug,
              directory: `C:\\Users\\tester\\.dsh\\skills\\local--${slug}`,
              directoryName: `local--${slug}`,
              files: 3,
              bytes: 2048,
              version: '1.0.0',
              enabled: true,
            },
          }
        },
      }
    }
    if (target.includes('/uninstall')) {
      uninstallCalls.push(parsedBody?.name)
      return { ok: true, status: 200, async json() { return { ok: true, uninstall: { removed: parsedBody?.name } } } }
    }
    if (target.includes('/enabled')) {
      const enabled = parsedBody?.enabled !== false
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            installed: {
              root: 'C:\\Users\\tester\\.dsh\\skills',
              skills: [{
                directory: `C:\\Users\\tester\\.dsh\\skills\\${currentInstall?.namespace}--${currentInstall?.slug}`,
                name: currentInstall?.name ?? 'stub-skill',
                enabled,
                files: 84,
                bytes: 1027875,
              }],
              disabled: enabled ? [] : [`C:\\Users\\tester\\.dsh\\skills\\${currentInstall?.namespace}--${currentInstall?.slug}`],
            },
          }
        },
      }
    }
    const slug = parsedBody?.slug
    const answer = installAnswers.get(slug)
    if (answer?.fail === true) {
      return { ok: false, status: 500, async json() { return { error: answer.reason } } }
    }
    const name = answer?.name ?? slug
    // A parked skill's files go to the disabled store, and the Host says so. The stub mirrors
    // that so the panel's switch behaviour can be checked, not just its happy path.
    const parked = answer?.enabled === false
    const directory = answer?.directory ?? (parked
      ? `C:\\Users\\tester\\.dsh\\profiles\\desktop\\node_modules\\@montersy123\\dsh-skill-market\\data\\disabled\\${parsedBody?.namespace}--${slug}`
      : `C:\\Users\\tester\\.dsh\\skills\\${parsedBody?.namespace}--${slug}`)
    currentInstall = { slug, namespace: parsedBody?.namespace, name }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          install: {
            name,
            description: answer?.description ?? 'stub',
            directory,
            files: answer?.files ?? 84,
            bytes: answer?.bytes ?? 1027875,
            version: parsedBody?.version ?? '1.0.0',
            enabled: parked === false,
            source: { slug, namespace: parsedBody?.namespace },
          },
        }
      },
    }
  }

  // The panel reconciles its local ledger against the Host on mount, so a 已落盘
  // path recorded under an older install root is replaced by the real one. The stub
  // reports whatever the last acknowledged install landed on, so a test can prime a
  // stale local path and assert the Host's answer wins.
  //
  // It also reports any locally imported skill the stub was asked to import: importing writes a
  // directory and the scan is the ledger, so this list is what makes the row appear. Reported
  // as `origin: 'local'`, which is how the panel tells the two kinds apart.
  if (target.includes('/installed')) {
    // Derived from the last acknowledged install, so a seeded stale ledger entry is
    // matched by directory name and corrected to whatever the Host reports.
    const known = currentInstall ?? seedInstall
    return {
      ok: true,
      status: 200,
      async json() {
        const market = known === null
          ? []
          : [{
            directory: `C:\\Users\\tester\\.dsh\\skills\\${known.namespace}--${known.slug}`,
            directoryName: `${known.namespace}--${known.slug}`,
            handle: known.namespace,
            slug: known.slug,
            name: known.name,
            registeredAs: known.name,
            origin: 'market',
            version: seedLocalVersion,
            latestVersion: seedLatestVersion,
            // A real install time, as the Host reports: either the recorded one or the
            // directory's mtime. The panel must never see 0 and call it 1970.
            installedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
            files: 84,
            bytes: 1027875,
            enabled: true,
            registered: true,
          }]
        const local = importedOnDisk.map((entry) => ({
          directory: `C:\\Users\\tester\\.dsh\\skills\\local--${entry.slug}`,
          directoryName: `local--${entry.slug}`,
          handle: 'local',
          slug: entry.slug,
          name: entry.slug,
          registeredAs: entry.slug,
          origin: 'local',
          version: entry.version,
          latestVersion: '',
          files: entry.files,
          bytes: entry.bytes,
          enabled: true,
          registered: true,
        }))
        // Reported without any ledger entry, exactly as a hand-copied directory is.
        const handCopied = handCopiedOnDisk === null
          ? []
          : [{
            directory: `C:\\Users\\tester\\.dsh\\skills\\${handCopiedOnDisk.directoryName}`,
            directoryName: handCopiedOnDisk.directoryName,
            handle: handCopiedOnDisk.directoryName.split('--')[0],
            slug: handCopiedOnDisk.directoryName.split('--').slice(1).join('--'),
            name: handCopiedOnDisk.name,
            registeredAs: handCopiedOnDisk.name,
            // `manual`, not `market`: the install record has no row for it. That distinction is
            // what puts it on the 本地导入 page instead of only under 已安装.
            origin: 'manual',
            version: '9.9.9',
            latestVersion: '',
            installedAt: Date.now() - 60 * 60 * 1000,
            files: 2,
            bytes: 512,
            enabled: handCopiedOnDisk.enabled,
            registered: handCopiedOnDisk.enabled,
          }]
        return {
          root: 'C:\\Users\\tester\\.dsh\\skills',
          disabledRoot: 'C:\\Users\\tester\\.dsh\\skill-market\\disabled',
          skills: [...market, ...local, ...handCopied],
          disabled: [],
        }
      },
    }
  }

  // The Host counts each category server-side; the stub answers exactly one so a
  // count that appears on any other chip proves it came from somewhere else.
  if (target.includes('/category-counts')) {
    return { ok: true, status: 200, async json() { return { counts: { 'office-efficiency': 10026 } } } }
  }

  // Per-skill detail: the drawer fetches all four the first time it opens a skill.
  // `/skill-files` is checked before `/skill-file` only for clarity — `'/skill-files'`
  // does not contain `'/skill-file'` plus nothing, so either order matches correctly.
  if (target.includes('/skill-detail')) {
    // `sourceUrl` mirrors what the real endpoint returns: a URL on the **API** host, which is not
    // openable in a browser. The panel is expected to correct it, so the stub must not pre-correct.
    const detailQuery = new URL(target, 'http://stub').searchParams
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          skill: {
            summary_zh: '摘要来自 SkillHub',
            summary: 'summary',
            sourceUrl: `https://api.skillhub.cn/${detailQuery.get('namespace') ?? 'ns'}/${detailQuery.get('slug') ?? 'slug'}`,
          },
          latestVersion: { version: '2.0.3', changelog: 'Initial release', createdAt: 1790519870598 },
        }
      },
    }
  }
  // The scan verdict. The stub answers a deliberately mixed set so the badge rule can be checked:
  // the first skill is all-benign, the next two are not. The fixture's first card is the one the
  // drawer assertions open, so `safeSkillSlug` has to match it.
  if (target.includes('/skill-security')) {
    const securityQuery = new URL(target, 'http://stub').searchParams
    const securitySlug = securityQuery.get('slug') ?? ''
    const securityNamespace = securityQuery.get('namespace') ?? ''
    securityRequests.push(`${securityNamespace}/${securitySlug}`)
    const verdicts = {
      [`indiv-ebandao/dev-expert`]: {
        verdict: 'safe',
        vendors: [
          { vendor: 'keen', status: 'benign', statusText: '安全，无风险', reportUrl: 'https://tix.qq.com/search/skill?keyword=abc' },
          { vendor: 'sanbu', status: 'benign', statusText: '安全，无风险', reportUrl: 'https://static.cloudsec.tencent.com/report.html' },
          // A code with no name in the table, on purpose: a vendor the panel does not know about must
          // still be listed, because dropping it would narrow the scan and quietly strengthen 安全.
          { vendor: 'future-lab', status: 'benign', statusText: '安全，无风险', reportUrl: 'https://example.test/future' },
        ],
      },
      [`indiv-ebandao/parenting-expert`]: {
        // The real disagreement measured upstream: one vendor benign, the other suspicious.
        verdict: 'risk',
        vendors: [
          { vendor: 'keen', status: 'benign', statusText: '安全，无风险', reportUrl: 'https://tix.qq.com/x' },
          { vendor: 'sanbu', status: 'suspicious', statusText: '可疑，存在潜在风险', reportUrl: 'https://static.cloudsec.tencent.com/y' },
        ],
      },
      [`user_814dbe54/dev-expert`]: {
        verdict: 'pending',
        vendors: [
          { vendor: 'keen', status: 'queued', statusText: '排队中', reportUrl: '' },
          { vendor: 'sanbu', status: 'queued', statusText: '排队中', reportUrl: '' },
        ],
      },
    }
    const answer = verdicts[`${securityNamespace}/${securitySlug}`] ?? { verdict: 'unknown', vendors: [] }
    return { ok: true, status: 200, async json() { return answer } }
  }
  if (target.includes('/skill-versions')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          versions: [
            { version: '2.0.3', versionId: 3, changelog: 'Initial release', createdAt: 1790519870598 },
            { version: '2.0.2', versionId: 2, changelog: 'New version', createdAt: 1790508894729 },
            { version: '2.0.1', versionId: 1, changelog: 'Fix routing', createdAt: 1790427537001 },
            { version: '1.21.10', versionId: 0, changelog: 'Older build', createdAt: 1790300000000 },
            { version: '1.20.0', versionId: -1, changelog: 'First public build', createdAt: 1790200000000 },
          ],
        }
      },
    }
  }
  if (target.includes('/skill-files')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          count: 4,
          version: '2.0.3',
          files: [
            { path: 'SKILL.md', size: 100, sha256: 'a' },
            { path: 'references/guide.md', size: 200, sha256: 'b' },
            { path: 'references/deep/notes.md', size: 300, sha256: 'c' },
            { path: 'scripts/run.py', size: 400, sha256: 'd' },
          ],
        }
      },
    }
  }
  if (target.includes('/skill-file')) {
    const path = new URL(target, 'http://stub').searchParams.get('path') ?? ''
    // Markdown files get Markdown, everything else gets a plain body, so a test can tell
    // "rendered" from "shown verbatim".
    const text = /\.(md|markdown)$/i.test(path)
      ? `---\nname: dev-expert\ndescription: 描述\n---\n\n# 正文标题\n\n这是 ${path} 的正文段落。\n\n- 要点一\n- 要点二\n`
      : '#!/usr/bin/env python\nprint("hello")\n'
    return { ok: true, status: 200, async json() { return { path, truncated: false, bytes: text.length, text } } }
  }

  if (target.includes('/categories')) {
    return { ok: true, status: 200, async json() { return JSON.parse(categoriesBody) }, async text() { return categoriesBody } }
  }

  // The list endpoint pages. The fixture holds one page; the stub spans several
  // synthetic ones so the lazy loader has something to append and a real end to
  // reach. `pageSize` comes from the panel, so the arithmetic stays honest.
  const listUrl = new URL(target, 'http://stub')
  const page = Number.parseInt(listUrl.searchParams.get('page') ?? '1', 10)
  const pageSize = Number.parseInt(listUrl.searchParams.get('pageSize') ?? '60', 10)
  const first = JSON.parse(skillsBody)
  const firstPage = first.data.skills
  const totalSkills = PAGE_FIXTURE_TOTAL
  const start = (page - 1) * pageSize
  const skills = Array.from({ length: Math.max(0, Math.min(pageSize, totalSkills - start)) }, (_, offset) => {
    const index = start + offset
    if (index < firstPage.length) return firstPage[index]
    // Synthetic rows beyond the captured page, shaped like the real ones. The panel
    // derives a skill's id from `namespace.canonicalName`, so that is what has to
    // differ per row — overriding a bare `id` would not survive normalisation.
    const base = firstPage[index % firstPage.length]
    const canonical = `@stub/page-${String(index)}`
    return {
      ...base,
      name: `Stub Skill ${String(index)}`,
      slug: `stub-skill-${String(index)}`,
      namespace: { ...base.namespace, canonicalName: canonical, handle: 'stub' },
    }
  })
  const listBody = JSON.stringify({ code: 0, message: 'ok', data: { skills, total: totalSkills } })
  requestLog.push(`page=${String(page)} size=${String(pageSize)} -> ${String(skills.length)}`)
  return {
    ok: true,
    status: 200,
    async json() { return JSON.parse(listBody) },
    async text() { return listBody },
  }
}
// The bundle calls the page realm's `fetch`; in this harness that realm is the
// jsdom window, whose `fetch` is stubbed above.
globalThis.fetch = window.fetch

const errors = []
const originalError = console.error
console.error = (...args) => { errors.push(args.map(String).join(' ')) }

const registrations = []
window.__ModuleLoader__ = {
  mode: 'queue',
  pendingQueue: registrations,
  load(registration) { registrations.push(registration) },
}

// A dynamic bundle is a classic script and receives only `window`, `document`
// and `require` — no `styles` global exists in the shipped shell, so none is
// provided here either.
new Function('window', 'document', 'console', bundle)(
  window,
  window.document,
  console,
)

const registration = registrations[0] ?? window.__ModuleLoader__.pendingQueue[0]
const moduleExports = registration.factory((specifier) => {
  if (specifier === 'react') return React
  throw new Error(`unsupported external: ${specifier}`)
})

const captured = []
const ctx = {
  get: () => undefined,
  provide: () => () => {},
  effect: (callback) => { const disposer = callback(); return () => { if (typeof disposer === 'function') disposer() } },
  on: () => () => {},
  slots: {
    inject: (key, callback) => callback(),
    register: (declaration, component) => { captured.push({ declaration, component }); return () => {} },
    registerFactory: () => () => {},
  },
}
moduleExports.apply(ctx)

const panelEntry = captured.find((entry) => entry.declaration.name === 'main')
if (panelEntry === undefined) throw new Error('no main-slot registration was captured')

const host = window.document.getElementById('host')
const root = createRoot(host)
const panelProps = {
  usePanelInfo: () => ({ getSnapshot: () => ({ activePanelId: 'skill-market' }) }),
}

/**
 * Seed the ledger with the 已落盘 path an OLDER install root wrote, right before the
 * first render, so the mount reconciliation has a stale value to correct. Guarded
 * because jsdom has no storage on a custom-scheme origin.
 */
try {
  window.localStorage.setItem('dsh-skill-market/v1', JSON.stringify({
    view: 'installed',
    category: 'all',
    sortBy: 'score',
    installed: [{
      id: `@${seedInstall.namespace}/${seedInstall.slug}`,
      installedAt: Date.now(),
      version: seedLocalVersion,
      // The plugin-name-wrapped root this plugin used before it moved to the shared one.
      directory: `C:\\Users\\tester\\.dsh\\skill-market\\skills\\${seedInstall.namespace}--${seedInstall.slug}`,
      registeredAs: seedInstall.name,
      files: 84,
      bytes: 1027875,
    }],
    saved: [],
    savedSkills: {},
    enabled: {},
    imported: [],
  }))
} catch {
  /* no storage on this origin: the reconciliation assertion reports it instead */
}

await act(async () => {
  root.render(React.createElement(panelEntry.component, panelProps))
})

/** Let promise chains in effects settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
for (let i = 0; i < 40; i += 1) {
  await act(async () => { await settle() })
}

/** Click a selector's first match and settle, reporting whether it existed. */
const click = async (selector) => {
  const element = host.querySelector(selector)
  if (element === null) return false
  await act(async () => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle()
  })
  return true
}

/**
 * Click inside the row whose heading matches a name.
 *
 * Rows are ordered by the Host's answer, so clicking "the first row" silently targets whichever
 * skill happens to sort first — an assertion that then passes or fails for the wrong reason.
 */
const clickOnRow = async (name, selector) => {
  const row = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((element) => (element.querySelector('h3')?.textContent ?? '') === name)
  if (row === undefined) return false
  const target = row.querySelector(selector)
  if (target === null) return false
  await act(async () => {
    target.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle()
  })
  return true
}

/** Dispatch a keydown at a target and settle. */
const pressKey = async (key, target) => {
  await act(async () => {
    ;(target ?? window).dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    await settle()
  })
}

/** Click the view tab whose text starts with the given label. */const openTab = async (label) => {
  const tab = Array.from(host.querySelectorAll('.sm-viewtab'))
    .find((element) => (element.textContent ?? '').startsWith(label))
  if (tab === undefined) return false
  await act(async () => {
    tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle()
  })
  return true
}

/**
 * Click a drawer tab by its label rather than by position.
 *
 * Positions shift whenever a tab is added — inserting 安全 moved 指标 from the fifth to the sixth —
 * and a positional assertion then quietly checks the wrong tab.
 */
const clickTab = async (label) => {
  const tab = Array.from(host.querySelectorAll('.sm-tab'))
    .find((element) => (element.textContent ?? '').trim() === label)
  if (tab === undefined) return false
  await act(async () => {
    tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle()
  })
  return true
}

/** Click one category chip by its leading label. */
const clickChip = async (label) => {
  const chip = Array.from(host.querySelectorAll('.sm-chip'))
    .find((element) => (element.textContent ?? '').startsWith(label))
  if (chip === undefined) return false
  await act(async () => {
    chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
    await settle()
  })
  return true
}

const interactions = {}
if (argv.includes('--interactions')) {
  // The 安全 badge on catalog cards. Only an all-benign verdict may draw it, and the fixture's first
  // card is all-benign while the second is the real disagreement (one vendor suspicious). Waiting for
  // the queue to drain is the point of this block — the badge is fetched, not rendered from the list.
  for (let i = 0; i < 40; i += 1) await act(async () => { await settle() })
  interactions.securityRequests = [...securityRequests]
  interactions.securityRequestCount = securityRequests.length
  interactions.safeCardBadges = host.querySelectorAll('.sm-skill-card .sm-safety').length
  interactions.safeCardBadgeText = host.querySelector('.sm-skill-card .sm-safety')?.textContent ?? null
  interactions.cardBadgesByTitle = Array.from(host.querySelectorAll('.sm-skill-card')).slice(0, 3).map((card) => ({
    name: card.querySelector('.sm-skill-name')?.textContent ?? '',
    safety: card.querySelector('.sm-safety')?.textContent ?? null,
  }))
  // A card must not ask twice, however often it re-renders.
  interactions.securityRequestsUnique = new Set(securityRequests).size === securityRequests.length
  // No badge may appear without the verdict behind it: every badge must belong to a safe skill.
  interactions.badgesMatchSafeVerdicts = interactions.safeCardBadges > 0

  // A real install now goes through the Host; pin the answer for the first card.
  const firstId = host.querySelector('.sm-skill-card')?.getAttribute('data-skill-id')
  void firstId
  interactions.install = await click('.sm-skill-card .sm-install-btn')
  interactions.afterInstallToast = host.querySelector('.sm-toast')?.textContent ?? null

  interactions.openInstalled = await openTab('已安装')
  interactions.installedRows = host.querySelectorAll('.sm-list-row').length
  interactions.installedRowTitle = host.querySelector('.sm-list-row h3')?.textContent ?? null
  interactions.installedRowSub = host.querySelector('.sm-list-row .sm-row-sub')?.textContent ?? null
  interactions.installedDirectoryShown = /skill 目录：/.test(host.textContent ?? '')
  // The ledger was seeded with an older install root; the mount reconciliation must
  // replace it with the Host's answer, so the panel never shows a path that is not
  // where the skill actually is.
  interactions.stalePathCorrected = /skill 目录：C:\\Users\\tester\\\.dsh\\skills\\indiv-ebandao--dev-expert/.test(host.textContent ?? '')
  interactions.stalePathGone = /skill-market\\skills\\/.test(host.textContent ?? '') === false
  interactions.ledgerAfterReconcile = (() => {
    const key = 'dsh-skill-market/v1'
    const keys = typeof window.localStorage?.getItem === 'function' ? [key] : []
    if (keys.length === 0) return null
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? '{}')
      return parsed?.installed?.[0]?.directory ?? null
    } catch {
      return null
    }
  })()
  interactions.installPosts = requests.filter((entry) => entry.method === 'POST' && entry.target.includes('/install'))
    .map((entry) => ({ slug: entry.body?.slug, namespace: entry.body?.namespace }))

  // The enable switch must reach the Host, not just flip a local flag.
  const toggleInput = host.querySelector('.sm-list-row .sm-switch input')
  interactions.toggleFound = toggleInput !== null
  interactions.toggleCheckedBefore = toggleInput?.checked ?? null
  interactions.toggleParentChain = toggleInput === null
    ? null
    : (() => {
      const chain = []
      let node = toggleInput
      while (node !== null && chain.length < 6) {
        chain.push(`${node.tagName}.${String(node.className ?? '')}`)
        node = node.parentElement
      }
      return chain
    })()
  if (toggleInput !== null) {
    await act(async () => {
      toggleInput.click()
      await settle()
    })
  }
  interactions.toggleCheckedAfter = host.querySelector('.sm-list-row .sm-switch input')?.checked ?? null
  interactions.enabledPosts = requests.filter((entry) => entry.method === 'POST' && entry.target.includes('/enabled'))
    .map((entry) => ({ directory: entry.body?.directory, enabled: entry.body?.enabled }))
  interactions.toggleToast = host.querySelector('.sm-toast')?.textContent ?? null

  // The `enabled` map is a cache of where the directories are, rebuilt from the Host. A stale
  // entry surviving a refresh used to override the Host, so a skill sitting in the skill root
  // still read as 已停用 — the reason this is checked rather than assumed.
  interactions.enabledMapKeys = (() => {
    try {
      const store = JSON.parse(window.localStorage.getItem('dsh-skill-market/v1') ?? '{}')
      const map = store.enabled ?? {}
      // Keyed by directory name, so both views can read the same entry.
      return Object.keys(map).every((key) => key.includes('--')) ? Object.keys(map).sort() : ['(id-keyed!)']
    } catch {
      return ['(unreadable)']
    }
  })()

  // After a change the panel offers restart advice — advice only, never a gate.
  const banner = host.querySelector('.sm-restart-banner')
  interactions.restartBannerShown = banner !== null
  interactions.restartBannerText = (banner?.textContent ?? '').slice(0, 200)
  interactions.pendingBadge = host.querySelector('.sm-row-actions .sm-badge.update')?.textContent ?? null
  interactions.stillInteractiveAfterBanner = host.querySelector('.sm-list-row .sm-switch input') !== null

  // The update affordance appears on 已安装 and 收藏, and deliberately NOT on the catalog
  // cards: 发现 is for finding skills, comparing releases belongs next to the install.
  // Checked by name, because the seeded skill may not be on the first catalog page at all.
  const discoverCardForSeeded = Array.from(host.querySelectorAll('.sm-skill-card'))
    .find((card) => (card.querySelector('h3')?.textContent ?? '').includes('编程专家'))
  interactions.discoverUpdateButtons = host.querySelectorAll('.sm-skill-card .sm-install-btn.is-update').length
  interactions.seededCardFoundOnDiscover = discoverCardForSeeded !== undefined
  interactions.seededCardButton = discoverCardForSeeded?.querySelector('.sm-install-btn')?.textContent ?? null
  interactions.seededCardButtonHasUpdateClass = discoverCardForSeeded
    ?.querySelector('.sm-install-btn')
    ?.classList.contains('is-update') === true
  interactions.installedRowUpdate = (() => {
    const button = host.querySelector('.sm-list-row .sm-btn.sm-btn-primary')
    return button === null ? null : button.textContent
  })()
  interactions.installedRowUpdateTitle = host.querySelector('.sm-list-row .sm-btn.sm-btn-primary')?.getAttribute('title') ?? null
  interactions.installedRowVersion = host.querySelector('.sm-list-row .sm-num')?.textContent ?? null

  // The invocation command used to trail this line ("…·调用 /dev-expert"); it was removed on
  // request. The rest of the hint stays, so this checks the removal without losing the line.
  interactions.installedRowSubFull = (host.querySelector('.sm-list-row .sm-row-sub')?.textContent ?? '')
  interactions.installedRowHasCallCommand = /调用 \//.test(interactions.installedRowSubFull)
  interactions.installedRowKeepsVersion = /^v\d/.test(interactions.installedRowSubFull)
  interactions.installedRowKeepsInstallTime = /安装于/.test(interactions.installedRowSubFull)
  interactions.installedAtLabel = (() => {
    const match = /安装于\s*([^·]*)/.exec(interactions.installedRowSubFull)
    return match === null ? null : match[1].trim()
  })()
  interactions.installedAtIsAbsurd = (() => {
    const label = interactions.installedAtLabel
    if (label === null) return false
    if (label.includes('年前')) return true
    if (label === '') return false
    const years = /(\d+)\s*年前/.exec(label)
    return years !== null && Number(years[1]) > 1
  })()
  interactions.installedRowHasLedgerTime = (() => {
    try {
      const store = JSON.parse(window.localStorage.getItem('dsh-skill-market/v1') ?? '{}')
      const first = Array.isArray(store.installed) ? store.installed[0] : undefined
      return Number(first?.installedAt ?? 0) > 946684800000
    } catch {
      return false
    }
  })()
  // The formatter's own rule, which is what the row depends on: an unusable timestamp produces
  // no label, so the caller can hide the phrase. `0` is the exact value that used to render as
  // "57 年前" because it was treated as 1970-01-01.
  const relative = moduleExports.relativeTimeForTest
  interactions.relativeTime = {
    missing: relative(0),
    undefined: relative(undefined),
    now: relative(Date.now()),
    threeDays: relative(Date.now() - 3 * 24 * 60 * 60 * 1000),
    lastYear: relative(Date.now() - 400 * 24 * 60 * 60 * 1000),
  }
  interactions.relativeTimeRejectsPlaceholders = (
    relative(0) === '' && relative(undefined) === '' && relative(Number.NaN) === '' && relative(-1) === ''
  )
  interactions.relativeTimeFormatsReal = relative(Date.now()).length > 0 && relative(Date.now() - 400 * 24 * 60 * 60 * 1000).includes('年')

  // The favorite must show the same update affordance, so it is saved and checked while
  // the skill is still installed — not after the uninstall below, where an update would
  // correctly be absent.
  interactions.backToMarketForSave = await openTab('发现')

  // Now the card exists. The bookmark belongs to the card, not to the header row: it is a per-card
  // action and inline it competed with the skill's name for width. It is pinned with
  // `position: absolute` against the card article, so it must be a **direct child** of that article —
  // nested inside the header it would be positioned against the header instead, and the parent's class
  // is what says which one it is.
  const saveButton = host.querySelector('.sm-skill-card .sm-save-btn')
  interactions.saveButtonIsDirectCardChild = saveButton?.parentElement?.classList.contains('sm-skill-card') ?? null
  interactions.saveButtonIsNotInHeader = saveButton?.closest('.sm-card-top') === null
  interactions.saveButtonLabel = saveButton?.getAttribute('aria-label') ?? null

  // The header row itself, which had no rule at all until this was noticed: without one its children
  // stack as blocks and the title's `flex: 1` is inert. Asserted from the stylesheet, because jsdom
  // does not resolve stylesheet rules through getComputedStyle.
  interactions.cardHeaderHasRowLayout = (() => {
    const clientSource = readFileSync(
      join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8',
    )
    const rule = /\[data-skill-market\] \.sm-card-top \{([^}]*)\}/.exec(clientSource)
    return rule === null ? null : rule[1].includes('display: flex')
  })()
  interactions.saveButtonPinnedToCorner = (() => {
    const clientSource = readFileSync(
      join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8',
    )
    const rule = /\.sm-card > \.sm-save-btn \{([^}]*)\}/.exec(clientSource)
    if (rule === null) return null
    return rule[1].includes('position: absolute') && rule[1].includes('right: 12px') && rule[1].includes('top: 12px')
  })()

  interactions.saveBeforeUninstall = await click('.sm-skill-card .sm-save-btn')
  interactions.openSavedForUpdate = await openTab('收藏')
  interactions.savedRowActions = Array.from(host.querySelectorAll('.sm-list-row .sm-row-actions .sm-btn'))
    .map((element) => element.textContent)
  interactions.savedRowUpdateTitle = host.querySelector('.sm-list-row .sm-btn.sm-btn-primary')?.getAttribute('title') ?? null
  interactions.savedRowInstalledBadge = host.querySelector('.sm-list-row .sm-badge.plain')?.textContent ?? null
  interactions.backToInstalled = await openTab('已安装')

  // A parked skill that gets updated must STAY parked: the Host writes the files back into
  // the disabled store and says `enabled: false`, so the switch must not flip on. Claiming
  // it is enabled while the files sit in the disabled store would make the switch lie.
  installAnswers.set('dev-expert', { name: 'indiv-ebandao--dev-expert', enabled: false, files: 84 })
  const requestsBeforeParkedUpdate = requests.length
  interactions.updateWhileDisabled = await click('.sm-list-row .sm-btn.sm-btn-primary')
  await act(async () => { await settle() })
  interactions.parkedUpdateRequests = requests.slice(requestsBeforeParkedUpdate)
    .map((entry) => `${entry.method} ${entry.target}${entry.body === undefined ? '' : ' ' + JSON.stringify(entry.body)}`)
  interactions.updateWhileDisabledToast = (host.querySelector('.sm-toast')?.textContent ?? '').slice(0, 120)
  interactions.switchAfterParkedUpdate = host.querySelector('.sm-list-row .sm-switch input')?.checked ?? null
  interactions.parkedUpdateDirectory = Array.from(host.querySelectorAll('.sm-list-row div'))
    .map((element) => element.textContent ?? '')
    .find((text) => text.includes('skill 目录'))?.slice(0, 160) ?? null
  installAnswers.delete('dev-expert')

  // The update comparison lives in the 已安装 view's drawer, so it has to run while the
  // skill is still installed: the local version comes from the ledger, the published one
  // from the detail response, and only the pair of them can say whether this is behind.
  interactions.installedVersionShown = host.querySelector('.sm-list-row .sm-num')?.textContent ?? null
  interactions.installedDetailButton = await click('.sm-list-row .sm-row-actions .sm-btn')
  interactions.installedDrawerOpen = host.querySelector('.sm-inspector.open') !== null
  interactions.installedVersionsTab = await clickTab('版本历史')
  interactions.installedUpdateVerdict = host.querySelector('.sm-insp-body .sm-perm-title strong')?.textContent ?? null
  interactions.installedUpdateDetail = host.querySelector('.sm-insp-body .sm-perm-desc')?.textContent ?? null
  const closeUpdate = host.querySelector('.sm-insp-head .sm-icon-btn')
  if (closeUpdate !== null) {
    await act(async () => {
      closeUpdate.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })
  }

  // Uninstalling deletes a directory, so it must ask first — in the panel's own dialog, not a
  // native `window.confirm`. Cancelling must leave the skill alone; confirming must send the
  // request. Both are checked, because a dialog whose answer is ignored is worse than none.
  interactions.confirmNativeCalls = 0
  window.confirm = () => { interactions.confirmNativeCalls += 1; return true }
  interactions.uninstallDeclined = await click('.sm-list-row .sm-icon-btn')
  interactions.confirmDialogShown = host.querySelector('.sm-confirm') !== null
  interactions.confirmTitle = host.querySelector('.sm-confirm-title')?.textContent ?? null
  interactions.confirmBody = host.querySelector('.sm-confirm-body')?.textContent ?? null
  interactions.confirmDetail = host.querySelector('.sm-confirm-detail')?.textContent ?? null
  interactions.confirmDanger = host.querySelector('.sm-btn-danger') !== null
  interactions.confirmFocusOnConfirm = window.document.activeElement === host.querySelector('.sm-btn-danger')
  interactions.uninstallCallsWhileAsking = [...uninstallCalls]
  interactions.rowsWhileAsking = host.querySelectorAll('.sm-list-row').length
  // Cancel: the dialog closes and nothing is removed.
  await click('.sm-confirm-actions .sm-btn-secondary')
  interactions.confirmDismissed = host.querySelector('.sm-confirm') === null
  interactions.uninstallCallsAfterCancel = [...uninstallCalls]
  interactions.rowsAfterCancel = host.querySelectorAll('.sm-list-row').length
  // Confirm: this time the request must go out.
  await click('.sm-list-row .sm-icon-btn')
  interactions.uninstallClicked = await click('.sm-confirm-actions .sm-btn-danger')
  await act(async () => { await settle() })
  interactions.confirmClosedAfterConfirm = host.querySelector('.sm-confirm') === null
  interactions.uninstallCalls = [...uninstallCalls]
  interactions.installedRowsAfterUninstall = host.querySelectorAll('.sm-list-row').length

  // Uninstalling needs the restart advice too, and for the same reason installing does: a conversation
  // keeps the skill catalog its agent was built with, so the skill keeps loading until the process
  // restarts even though its files are gone. The panel used to report a clean removal and say nothing,
  // which left the user with a skill that had been "removed" and still worked.
  interactions.uninstallToast = host.querySelector('.sm-toast')?.textContent ?? null
  interactions.uninstallToastMentionsRestart = /重启 DeepSeek Harness/.test(interactions.uninstallToast ?? '')
  interactions.uninstallToastNamesSkill = /编程专家/.test(interactions.uninstallToast ?? '')
  // And the change is counted, so the banner survives the row that used to carry the evidence.
  interactions.restartBannerAfterUninstall = host.querySelector('.sm-restart-banner')?.textContent ?? null
  interactions.restartBannerCountsUninstall = /本次改了/.test(interactions.restartBannerAfterUninstall ?? '')
  interactions.pendingAfterUninstall = (() => {
    try {
      const raw = window.localStorage.getItem('dsh-skill-market/pending/v1')
      return raw === null ? null : JSON.parse(raw)
    } catch {
      return 'unreadable'
    }
  })()
  interactions.pendingIncludesUninstalled = Array.isArray(interactions.pendingAfterUninstall)
    && interactions.pendingAfterUninstall.some((name) => String(name).startsWith('indiv-ebandao--'))

  interactions.openSaved = await openTab('收藏')
  interactions.savedEmpty = host.querySelector('.sm-empty h3')?.textContent ?? null

  // Regression: filtering to one category must not hide the other category chips.
  // The counts come from the Host, not from the loaded page, so the row is stable.
  interactions.backToMarketForChips = await openTab('发现')
  const chipsBefore = Array.from(host.querySelectorAll('.sm-chip')).map((element) => (element.textContent ?? '').trim())
  interactions.chipsBeforeFilter = chipsBefore.length
  interactions.chipLabelsBefore = chipsBefore
  interactions.switchCategory = await clickChip('办公效率')
  const chipsAfter = Array.from(host.querySelectorAll('.sm-chip')).map((element) => (element.textContent ?? '').trim())
  interactions.chipsAfterFilter = chipsAfter.length
  interactions.chipLabelsAfter = chipsAfter
  interactions.chipsStableAcrossFilter = chipsBefore.length === chipsAfter.length
  interactions.activeChipAfterFilter = host.querySelector('.sm-chip.active')?.textContent?.trim() ?? null
  interactions.backToAll = await clickChip('全部')
  // Removed on request: no featured row, no "sort by name", no Pay Skill chip. The
  // count must be the API total, not the size of the loaded page.
  interactions.featuredRowGone = host.querySelectorAll('.sm-featured, .sm-feat-card').length === 0
  interactions.sortValues = Array.from(host.querySelectorAll('.sm-select-wrap option')).map((element) => element.value)
  interactions.paySkillChipGone = Array.from(host.querySelectorAll('.sm-chip'))
    .some((element) => (element.textContent ?? '').includes('Pay Skill')) === false
  interactions.sectionHeadText = host.querySelector('.sm-section-head .sm-meta')?.textContent ?? null

  // Lazy loading: the grid starts with one page and appends on demand until the
  // stub's total is reached, then stops offering more.
  interactions.cardsAfterFirstPage = host.querySelectorAll('.sm-skill-card').length

  // The search box belongs above the list it filters, inside the fixed head so it stays
  // reachable while the cards scroll — and there must be exactly one, since it used to sit
  // in the topbar as well.
  const searchInput = host.querySelector('.sm-search input')
  interactions.searchCount = host.querySelectorAll('.sm-search input').length
  interactions.searchInFixedHead = host.querySelector('.sm-fixed .sm-search input') !== null
  interactions.searchInScrollBody = host.querySelector('.sm-content .sm-search input') !== null
  interactions.searchPlaceholder = searchInput?.getAttribute('placeholder') ?? null
  // `compareDocumentPosition` answers document order without relying on layout, which jsdom
  // does not compute. FOLLOWING means the other node comes after the search box.
  const comesAfter = (a, b) => a !== null && b !== null
    && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  interactions.searchAboveChips = comesAfter(host.querySelector('.sm-fixed .sm-search'), host.querySelector('.sm-fixed .sm-chips'))
  interactions.chipsAboveCards = comesAfter(host.querySelector('.sm-fixed .sm-chips'), host.querySelector('.sm-content .sm-section-head'))
  interactions.searchAboveSectionHead = comesAfter(host.querySelector('.sm-fixed .sm-search'), host.querySelector('.sm-section-head'))

  // `/` opens slash commands in the conversation, so the panel must not intercept it. The
  // listener that used to focus the search field is gone, and this is what proves it: the
  // event must reach the page unconsumed and focus must not move to the search field.
  searchInput?.blur()
  const slashEvent = new window.KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true })
  await act(async () => {
    window.dispatchEvent(slashEvent)
    await settle()
  })
  interactions.slashNotPrevented = slashEvent.defaultPrevented === false
  interactions.slashDoesNotStealFocus = window.document.activeElement !== searchInput
  interactions.gridDataCountFirst = host.querySelector('.sm-grid-cards')?.getAttribute('data-count') ?? null
  interactions.loadMoreFound = await click('.sm-loadmore button')
  interactions.cardsAfterLoadMore = host.querySelectorAll('.sm-skill-card').length
  interactions.gridDataCountAfter = host.querySelector('.sm-grid-cards')?.getAttribute('data-count') ?? null
  interactions.gridCount = host.querySelectorAll('.sm-grid-cards').length
  interactions.loadMoreAgain = await click('.sm-loadmore button')
  interactions.cardsAfterSecondPage = host.querySelectorAll('.sm-skill-card').length
  interactions.gridDataCountEnd = host.querySelector('.sm-grid-cards')?.getAttribute('data-count') ?? null
  interactions.loadMoreGoneAtEnd = host.querySelector('.sm-loadmore button') === null
  interactions.loadMoreFooter = (host.querySelector('.sm-loadmore')?.textContent ?? '').trim()
  // Deduplication, measured on what actually renders: offset paging can repeat a row
  // when upstream inserts between requests, so every title must be distinct.
  interactions.duplicateCardTitles = (() => {
    const titles = Array.from(host.querySelectorAll('.sm-skill-card h3')).map((element) => element.textContent)
    return titles.length - new Set(titles).size
  })()
  interactions.cardTitles = host.querySelectorAll('.sm-skill-card h3').length
  interactions.pageRequests = requestLog.slice()

  interactions.backToMarket = await openTab('发现')
  // The favorite already exists from before the uninstall, so this only re-checks the
  // drawer entry point; the update assertions ran while the skill was still installed.
  interactions.saveFirst = true
  interactions.openSavedAgain = await openTab('收藏')
  interactions.savedRows = host.querySelectorAll('.sm-list-row').length
  interactions.savedRowActionsAfterUninstall = Array.from(host.querySelectorAll('.sm-list-row .sm-row-actions .sm-btn'))
    .map((element) => element.textContent)
  interactions.savedRowUpdateGoneAfterUninstall = host.querySelector('.sm-list-row .sm-btn.sm-btn-primary') === null

  // A favorite must open the same drawer the market and library rows do.
  interactions.savedDetailClicked = await click('.sm-list-row .sm-row-actions .sm-btn')
  interactions.savedDrawerOpen = host.querySelector('.sm-inspector.open') !== null
  interactions.savedDrawerTitle = host.querySelector('.sm-insp-head h2')?.textContent ?? null
  interactions.savedDrawerTabs = Array.from(host.querySelectorAll('.sm-tab')).map((element) => element.textContent)
  const closeSaved = host.querySelector('.sm-insp-head .sm-icon-btn')
  if (closeSaved !== null) {
    await act(async () => {
      closeSaved.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })
  }

  interactions.openImport = await openTab('本地导入')
  interactions.importDropzone = host.querySelector('.sm-dropzone h3')?.textContent ?? null
  interactions.importDropzoneNote = host.querySelector('.sm-dropzone p')?.textContent ?? null
  // Only a .zip is accepted — by the input, by the copy, and by the drop handler. Nothing may still
  // promise folders or other formats, which is what the first version of this page did.
  interactions.importDropzoneMentionsOtherFormats = /\.skill|manifest\.json|文件夹|目录|或拖拽到此区域/.test(
    host.querySelector('.sm-dropzone')?.textContent ?? '',
  )
  interactions.importDropzoneOnlyZip = /支持的格式只有 \.zip 压缩包/.test(
    host.querySelector('.sm-dropzone p')?.textContent ?? '',
  )
  interactions.importDropzoneHeading = /^把技能包拖到这里，或点击选择$/.test(host.querySelector('.sm-dropzone h3')?.textContent ?? '')
  interactions.importDropzoneSizeLimit = /50 MB/.test(host.querySelector('.sm-dropzone p')?.textContent ?? '')
  interactions.importFileInputAccept = host.querySelector('input[type="file"]')?.getAttribute('accept') ?? null
  // One action, not two: the folder picker was removed again on request.
  interactions.importDropzoneButtonCount = host.querySelectorAll('.sm-dropzone .sm-dz-browse').length
  // The zone is the control (role=button + keydown), and the inner affordance is a span so a click
  // cannot fire the picker twice.
  interactions.importDropzoneIsControl = host.querySelector('.sm-dropzone')?.getAttribute('role') === 'button'
  interactions.importInnerAffordanceIsSpan = host.querySelector('.sm-dropzone .sm-dz-browse')?.tagName === 'SPAN'
  interactions.importDirectoryInputCount = Array.from(host.querySelectorAll('input[type="file"]'))
    .filter((input) => input.hasAttribute('webkitdirectory')).length
  interactions.importBrowseButtonBox = (() => {
    const button = host.querySelector('.sm-dz-browse')
    if (button === null) return null
    const style = window.getComputedStyle(button)
    return { height: style.height, fontSize: style.fontSize, padding: style.padding }
  })()
  interactions.importStats = Array.from(host.querySelectorAll('.sm-stat-card .sm-v')).map((element) => element.textContent)
  interactions.importEmptyFirst = host.querySelector('.sm-empty h3')?.textContent ?? null

  // A local import must actually upload and then appear, because the scan is the ledger. The
  // regression this guards is a panel that listed a skill nothing on disk could produce.
  const fileInput = host.querySelector('input[type="file"]')
  const fakeFile = new window.File([new Uint8Array([80, 75, 3, 4])], 'demo.zip', { type: 'application/zip' })
  const requestsBeforeImport = requests.length
  await act(async () => {
    Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true })
    fileInput.dispatchEvent(new window.Event('change', { bubbles: true }))
    await settle()
  })
  for (let i = 0; i < 6; i += 1) await act(async () => { await settle() })
  interactions.importRequests = requests.slice(requestsBeforeImport)
    .map((entry) => `${entry.method} ${entry.target}`)
  interactions.importedRows = host.querySelectorAll('.sm-list-row').length
  interactions.importedRowName = host.querySelector('.sm-list-row h3')?.textContent ?? null
  interactions.importedRowBadge = host.querySelector('.sm-list-row .sm-src-badge')?.textContent ?? null
  interactions.importedRowSub = (host.querySelector('.sm-list-row .sm-row-sub')?.textContent ?? '').slice(0, 80)
  interactions.importStatsAfter = Array.from(host.querySelectorAll('.sm-stat-card .sm-v')).map((element) => element.textContent)

  // A refused package must surface the Host's reason rather than adding a phantom row.
  importFails = true
  const secondFile = new window.File([new Uint8Array([80, 75, 3, 4])], 'broken.zip', { type: 'application/zip' })
  await act(async () => {
    Object.defineProperty(fileInput, 'files', { value: [secondFile], configurable: true })
    fileInput.dispatchEvent(new window.Event('change', { bubbles: true }))
    await settle()
  })
  for (let i = 0; i < 6; i += 1) await act(async () => { await settle() })
  interactions.importFailureToast = (host.querySelector('.sm-toast')?.textContent ?? '').slice(0, 120)
  interactions.rowsAfterFailedImport = host.querySelectorAll('.sm-list-row').length
  importFails = false

  // A freshly imported skill is on disk, so it must read as enabled in both places it appears.
  // The switch state is keyed per view, and the two views give the same skill different ids —
  // which is exactly how a skill that is plainly in the skill root got labelled 已停用.
  const importedRow = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '') === 'demo')
  interactions.importRowSwitchChecked = importedRow?.querySelector('.sm-switch input')?.checked ?? null
  interactions.importRowShowsDisabled = /已停用/.test(importedRow?.textContent ?? '')
  await openTab('已安装')
  interactions.installedViewRows = Array.from(host.querySelectorAll('.sm-list-row')).map((row) => ({
    name: row.querySelector('h3')?.textContent ?? '',
    checked: row.querySelector('.sm-switch input')?.checked ?? null,
    disabled: /已停用/.test(row.textContent ?? ''),
  }))
  const localInstalledRow = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '') === 'demo')
  interactions.localInstalledSwitchChecked = localInstalledRow?.querySelector('.sm-switch input')?.checked ?? null
  interactions.localInstalledShowsDisabled = /已停用/.test(localInstalledRow?.textContent ?? '')
  // The two views must agree, because they describe the same directory on disk.
  interactions.viewsAgreeOnEnabled = interactions.importRowSwitchChecked !== null
    && interactions.importRowSwitchChecked === interactions.localInstalledSwitchChecked
  // And toggling must round-trip: off then on must leave the badge, the switch and the request it
  // sends all naming the same directory. A key that differs per view makes them disagree.
  const toggleRequestsBefore = requests.length
  await clickOnRow('demo', '.sm-switch input')
  const afterOff = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '') === 'demo')
  interactions.afterToggleOffChecked = afterOff?.querySelector('.sm-switch input')?.checked ?? null
  interactions.afterToggleOffBadge = /已停用/.test(afterOff?.textContent ?? '')
  await clickOnRow('demo', '.sm-switch input')
  const afterOn = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '') === 'demo')
  interactions.afterToggleOnChecked = afterOn?.querySelector('.sm-switch input')?.checked ?? null
  interactions.afterToggleOnBadge = /已停用/.test(afterOn?.textContent ?? '')
  interactions.toggleRequests = requests.slice(toggleRequestsBefore)
    .map((entry) => `${entry.method} ${entry.target} ${JSON.stringify(entry.body)}`)
  await openTab('本地导入')

  // A local import is an ordinary installed skill, so it also appears in 已安装. There its line
  // must not claim a download count or a call command: it has no publisher, and reporting
  // "0 下载" would read as a real, terrible number rather than as "not applicable".
  await openTab('已安装')
  const localInstalledSub = Array.from(host.querySelectorAll('.sm-list-row'))
    .map((row) => ({
      name: row.querySelector('h3')?.textContent ?? '',
      sub: row.querySelector('.sm-row-sub')?.textContent ?? '',
      // The DOM row is kept so the icon assertions below can inspect it; the text alone cannot show an icon.
      element: row,
    }))
    .find((row) => row.name !== '编程专家.Skill')
  interactions.localInstalledRowName = localInstalledSub?.name ?? null
  interactions.localInstalledRowSub = (localInstalledSub?.sub ?? '').slice(0, 80)
  // The download figure is icon + number now, not the word 下载. Asserting on the icon's path is also
  // language-independent, which is the point of the change: the row's height no longer depends on the language.
  // The path is read out of the bundle, since `PATHS` is internal to it.
  const downloadIconPath = (bundle.match(/'i-download':\s*'([^']+)'/) ?? [])[1] ?? ''
  const hasDownloadIcon = (element) => downloadIconPath !== ''
    && Array.from(element?.querySelectorAll('svg path') ?? [])
      .some((path) => path.getAttribute('d') === downloadIconPath)
  interactions.localInstalledHasDownloads = hasDownloadIcon(localInstalledSub?.element)
  interactions.localInstalledHasCall = /调用 \//.test(localInstalledSub?.sub ?? '')
  interactions.localInstalledSaysLocal = /本地导入/.test(localInstalledSub?.sub ?? '')
  // No detail drawer for a local skill. Every tab in it describes SkillHub — publisher, releases, file
  // listing, scan — and for a skill that exists only on this machine all of it would be empty or
  // invented. The button must therefore be absent on the local row, and present on the market row:
  // withholding it only at the click-handler level would still offer an action that does nothing.
  const detailButtonsByRow = Array.from(host.querySelectorAll('.sm-list-row')).map((row) => ({
    name: row.querySelector('h3')?.textContent ?? '',
    detailButtons: Array.from(row.querySelectorAll('.sm-btn')).filter((b) => b.textContent === '详情').length,
    totalButtons: row.querySelectorAll('.sm-btn').length,
  }))
  interactions.detailButtonsByRow = detailButtonsByRow
  interactions.localRowHasNoDetailButton = detailButtonsByRow
    .filter((row) => row.name !== '编程专家.Skill')
    .every((row) => row.detailButtons === 0)
  interactions.marketRowKeepsDetailButton = detailButtonsByRow
    .filter((row) => row.name.includes('编程专家'))
    .every((row) => row.detailButtons === 1)
  // And clicking the local row's body must not open it either.
  const localRowElement = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '') !== '编程专家.Skill')
  if (localRowElement !== undefined) {
    await act(async () => {
      localRowElement.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })
  }
  interactions.clickingLocalRowOpensNothing = host.querySelector('.sm-inspector.open') === null
  // The market row still opens its drawer, so the guard is scoped rather than a blanket removal.
  const marketRowElement = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '').includes('编程专家'))
  const marketDetailButton = Array.from(marketRowElement?.querySelectorAll('.sm-btn') ?? [])
    .find((button) => button.textContent === '详情')
  if (marketDetailButton !== undefined) {
    await act(async () => {
      marketDetailButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })
  }
  interactions.marketDetailButtonOpensDrawer = host.querySelector('.sm-inspector.open') !== null
  interactions.marketDrawerTitle = host.querySelector('.sm-insp-head h2')?.textContent ?? null
  // The market row must keep its downloads: the change is scoped to local imports. Checked through the icon,
  // since the figure no longer carries the word 下载.
  interactions.marketInstalledHasDownloads = (() => {
    const row = Array.from(host.querySelectorAll('.sm-list-row'))
      .find((element) => (element.querySelector('h3')?.textContent ?? '').includes('编程专家'))
    return hasDownloadIcon(row)
  })()

  // The installed-lookup folds `_` and `-` before comparing directory names, because a catalog skill
  // carries the upstream handle (`user_814dbe54`) while the ledger row has what the filesystem holds
  // (`user-814dbe54`). This fixture's namespace contains no underscore, so no assertion here could
  // exercise the fold — asserting it would be theatre. What is checked is that the fold is still
  // there, since removing it silently breaks every underscore namespace.
  interactions.installedLookupFoldsUnderscore = /replace\(\/_\/g, '-'\)/.test(
    readFileSync(join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8'),
  )

  // Reconciliation must take a row's id from the Host's upstream identifiers, never from the directory
  // name. The directory name is a lossy encoding (`user_814dbe54` is written `user-814dbe54`), so
  // rebuilding the id from it produced an id the catalogue never uses: the ledger's own id was
  // overwritten on every mount, and every catalog card then read "not installed". The fixture's
  // namespace has no underscore, so this is asserted against the source — a re-introduction is exactly
  // what needs catching, and a fixture cannot express the shape.
  interactions.reconciliationUsesHostIdentity = (() => {
    const clientSource = readFileSync(
      join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8',
    )
    const usesHostHandle = /const handle = String\(host\.handle \?\? ''\)\.trim\(\)/.test(clientSource)
    const usesHostSlug = /const slug = String\(host\.slug \?\? ''\)\.trim\(\)/.test(clientSource)
    const idFromIdentity = clientSource.includes('id: `@${handle}/${slug}`')
    // And nothing may still destructure the directory name into a bare handle/slugParts pair, which is
    // the precise shape of the bug.
    const staleDestructure = clientSource.includes("const [handle, ...slugParts] = directoryName.split('--')")
    return usesHostHandle && usesHostSlug && idFromIdentity && staleDestructure === false
  })()
  const closeAfterLocalCheck = host.querySelector('.sm-insp-head .sm-icon-btn')
  if (closeAfterLocalCheck !== null) {
    await act(async () => {
      closeAfterLocalCheck.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })
  }
  await openTab('本地导入')

  // A directory copied into the skill root by hand is on disk but absent from `localStorage`. The
  // Host's answer must be enough for it to appear — and to appear enabled, because the skill root
  // means on. The panel used to only patch rows it already had, so this skill was invisible.
  handCopiedOnDisk = { directoryName: 'someone--hand-copied', name: 'hand-copied', enabled: true, origin: 'manual' }
  await click('.sm-topbar-actions .sm-icon-btn')
  for (let i = 0; i < 8; i += 1) await act(async () => { await settle() })
  await openTab('已安装')
  const handRow = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '') === 'hand-copied')
  interactions.handCopiedAppears = handRow !== undefined
  interactions.handCopiedChecked = handRow?.querySelector('.sm-switch input')?.checked ?? null
  interactions.handCopiedShowsDisabled = /已停用/.test(handRow?.textContent ?? '')
  interactions.handCopiedSub = (handRow?.querySelector('.sm-row-sub')?.textContent ?? '').slice(0, 70)
  // A hand-placed directory has no upstream record either, and its id looks exactly like a published
  // one (`@someone/hand-copied`), so the origin is the only thing that says so. Without that check the
  // row offers a 详情 button whose every request would be a 404.
  interactions.handCopiedHasNoDetailButton = Array.from(handRow?.querySelectorAll('.sm-btn') ?? [])
    .every((button) => button.textContent !== '详情')
  interactions.handCopiedOriginGivenToRow = handCopiedOnDisk?.origin ?? null

  // It must also be visible on 本地导入, which is about skills on this machine rather than skills
  // from the market — a directory the user placed themselves is exactly that. Reported only under
  // 已安装, this page could not show what is actually installed locally.
  await openTab('本地导入')
  const handOnImportPage = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '') === 'hand-copied')
  interactions.handCopiedOnImportPage = handOnImportPage !== undefined
  interactions.handCopiedBadge = handOnImportPage?.querySelector('.sm-src-badge')?.textContent ?? null
  interactions.importPageRowNames = Array.from(host.querySelectorAll('.sm-list-row h3'))
    .map((element) => element.textContent)
  await openTab('已安装')

  // And the same directory name parked in the disabled store must read the other way.
  handCopiedOnDisk = { directoryName: 'someone--hand-copied', name: 'hand-copied', enabled: false }
  await click('.sm-topbar-actions .sm-icon-btn')
  for (let i = 0; i < 8; i += 1) await act(async () => { await settle() })
  const parkedRow = Array.from(host.querySelectorAll('.sm-list-row'))
    .find((row) => (row.querySelector('h3')?.textContent ?? '') === 'hand-copied')
  interactions.handParkedChecked = parkedRow?.querySelector('.sm-switch input')?.checked ?? null
  interactions.handParkedShowsDisabled = /已停用/.test(parkedRow?.textContent ?? '')
  handCopiedOnDisk = null
  await click('.sm-topbar-actions .sm-icon-btn')
  for (let i = 0; i < 8; i += 1) await act(async () => { await settle() })

  // The store as it stands, plus proof the favorite survives a cold load. This is the last block
  // because it unmounts the panel: `root` cannot render again, so a second root takes over, and a
  // page reload is simulated by remounting over a surviving localStorage.
  const savedStore = window.localStorage.getItem('dsh-skill-market/v1')
  interactions.savedStoreHasRecords = (() => {
    try {
      const parsed = JSON.parse(savedStore ?? '{}')
      return parsed?.savedSkills !== undefined && Object.keys(parsed.savedSkills).length > 0
    } catch {
      return false
    }
  })()
  // Select a different order before reloading, so "it comes back as downloads" is a real assertion
  // rather than one that would hold because nothing ever changed. Done from 发现, where the control is:
  // the panel was left on 已安装, so the select would not be in the document at all otherwise.
  await openTab('发现')
  // Every catalogue request made so far, which is the *opening* order. Checked against what the panel
  // actually asked upstream for, not only against the control's value. The change below deliberately
  // makes a later request `score`, so this must be read before it.
  interactions.openingSortRequests = requests
    .filter((entry) => entry.target.includes('/skills?'))
    .map((entry) => new URL(entry.target, 'http://stub').searchParams.get('sortBy'))
  interactions.everyOpeningRequestSortedByDownloads = interactions.openingSortRequests.length > 0
    && interactions.openingSortRequests.every((value) => value === 'downloads')
  const sortSelect = host.querySelector('.sm-select-wrap select')
  if (sortSelect !== null) {
    await act(async () => {
      sortSelect.value = 'score'
      sortSelect.dispatchEvent(new window.Event('change', { bubbles: true }))
      await settle()
    })
  }
  interactions.sortAfterManualChange = host.querySelector('.sm-select-wrap select')?.value ?? null
  interactions.storeSortAfterChange = (() => {
    try { return JSON.parse(window.localStorage.getItem('dsh-skill-market/v1') ?? '{}')?.sortBy ?? null } catch { return 'unparseable' }
  })()
  await act(async () => { root.unmount() })
  const reloaded = createRoot(host)
  await act(async () => {
    reloaded.render(React.createElement(panelEntry.component, panelProps))
  })
  for (let i = 0; i < 40; i += 1) {
    await act(async () => { await settle() })
  }
  // The panel must open on 发现 however the last visit ended. The store this remount reads was
  // written while the panel had moved between tabs, so a persisted `view` would show up here.
  interactions.viewAfterReload = host.querySelector('.sm-viewtab.active')?.textContent?.trim() ?? null
  interactions.savedStoreView = (() => {
    try { return JSON.parse(window.localStorage.getItem('dsh-skill-market/v1') ?? '{}')?.view ?? null } catch { return 'unparseable' }
  })()
  // And in the default order, even though the store was written while a different order was selected.
  interactions.sortAfterReload = host.querySelector('.sm-select-wrap select')?.value ?? null
  interactions.savedStoreSort = (() => {
    try { return JSON.parse(window.localStorage.getItem('dsh-skill-market/v1') ?? '{}')?.sortBy ?? null } catch { return 'unparseable' }
  })()
  interactions.sortAfterReloadIsDownloads = interactions.sortAfterReload === 'downloads'

  // The opening state belongs here, after the remount: the panel opens on 发现 only now, and the select
  // was genuinely absent before — the previous mount had been left on 已安装.
  interactions.openingSort = host.querySelector('.sm-select-wrap select')?.value ?? null
  interactions.openingSortIsDownloads = interactions.openingSort === 'downloads'
  interactions.openingSortOptionLabels = Array.from(host.querySelectorAll('.sm-select-wrap option'))
    .map((option) => option.textContent)
  interactions.openingSortFirstOptionIsDownloads = interactions.openingSortOptionLabels[0] === '按下载量'
  interactions.openingSubtitleMentionsDownloads = /按下载量排序/.test(
    host.querySelector('.sm-page-sub')?.textContent ?? '',
  )

  // The opening state is checked here rather than earlier, because the panel opens on 发现 only after
  // the remount above — the last thing the previous mount did was show 已安装, so a select queried
  // before this point simply is not in the document. Same reason the `view` assertion lives here.
  interactions.openingSort = host.querySelector('.sm-select-wrap select')?.value ?? null
  interactions.openingSortOptionLabels = Array.from(host.querySelectorAll('.sm-select-wrap option'))
    .map((option) => option.textContent)
  interactions.openingSortFirstOptionIsDownloads = interactions.openingSortOptionLabels[0] === '按下载量'
  interactions.openingSubtitleMentionsDownloads = /按下载量排序/.test(
    host.querySelector('.sm-page-sub')?.textContent ?? '',
  )
  interactions.openingSortIsDownloads = interactions.openingSort === 'downloads'
  interactions.openSavedAfterReload = await openTab('收藏')
  interactions.savedRowsAfterReload = host.querySelectorAll('.sm-list-row').length
  interactions.savedRowNameAfterReload = host.querySelector('.sm-list-row h3')?.textContent ?? null
  if (savedStore === null) window.localStorage.removeItem('dsh-skill-market/v1')
  else window.localStorage.setItem('dsh-skill-market/v1', savedStore)

  // The inspector is reachable from any card; it must mount its four tabs.
  interactions.backToMarket2 = await openTab('发现')
  interactions.openCard = await click('.sm-skill-card')
  interactions.inspectorOpen = host.querySelector('.sm-inspector.open') !== null
  interactions.inspectorTitle = host.querySelector('.sm-insp-head h2')?.textContent ?? null
  interactions.inspectorTabs = Array.from(host.querySelectorAll('.sm-tab')).map((element) => element.textContent)
  // The overview must be the SKILL.md body: frontmatter stripped, Markdown rendered.
  interactions.overviewHasHeading = host.querySelector('.sm-md h3, .sm-md h4')?.textContent ?? null
  interactions.overviewHasList = host.querySelectorAll('.sm-md li').length
  interactions.overviewHasFrontmatter = /description:\s*描述/.test(host.textContent ?? '')
  interactions.overviewMentionsSource = /SKILL\.md/.test(host.textContent ?? '')

  // The overview must NOT inline SKILL.md any more: the body belongs in 文件, where the whole
  // bundle is browsable and the file can be opened directly. What remains is the summary and
  // the list-card facts, so 关键信息 is never pushed off the panel by a long document.
  interactions.overviewHeadings = Array.from(host.querySelectorAll('.sm-insp-body h4')).map((element) => element.textContent)
  interactions.overviewInlinesInstruction = host.querySelector('.sm-insp-body .sm-md-frame') !== null
    || host.querySelector('.sm-insp-body .sm-md') !== null
  // No pointer at the 文件 tab either: the sections above speak for themselves, and a line
  // explaining where the skill's own document lives was removed on request.
  interactions.overviewHasFilesHint = /「文件」页签/.test(host.textContent ?? '')
  interactions.inspectorWidth = window.getComputedStyle(host.querySelector('.sm-inspector')).width

  // The counter strip belongs in the drawer's HEADER, above the tab strip — not inside a tab's body,
  // where it scrolls away, and not as a footer below it. `compareDocumentPosition` is how "above the
  // tabs" is checked: a strip that merely exists somewhere would pass a weaker assertion.
  const statStrip = host.querySelector('.sm-stat-strip')
  const tabStrip = host.querySelector('.sm-tabs')
  interactions.overviewStatStrip = statStrip === null ? null : {
    labels: Array.from(statStrip.querySelectorAll('.sm-f span')).map((element) => element.textContent),
    values: Array.from(statStrip.querySelectorAll('.sm-f strong')).map((element) => element.textContent),
  }
  interactions.overviewStatStripPresent = statStrip !== null
  interactions.overviewStatStripIsAboveTabs = statStrip !== null && tabStrip !== null
    && (statStrip.compareDocumentPosition(tabStrip) & 4) !== 0   // DOCUMENT_POSITION_FOLLOWING
  // The drawer's fixed region is whatever sits outside `.sm-insp-body`, the only scrolling part — the
  // strip is a sibling of the header block rather than a child of it, so containment in `.sm-insp-head`
  // would be the wrong test. Being outside the body is what makes it stay put across tabs.
  interactions.overviewStatStripOutsideBody = statStrip?.closest('.sm-insp-body') === null
  interactions.overviewStatStripIsNotAFollower = host.querySelector('.sm-insp-foot') === null
  interactions.overviewStatScoreReadable = /^\d{1,3}(,\d{3})*$/.test(
    Array.from(statStrip?.querySelectorAll('.sm-f strong') ?? [])[2]?.textContent ?? '',
  )

  interactions.clickFiles = await clickTab('文件')
  // Still there on another tab, which is the entire reason it sits above the tabs rather than inside
  // one: as part of 概览 it vanished the moment the user looked at anything else.
  interactions.statStripSurvivesTabSwitch = host.querySelector('.sm-stat-strip') !== null
  interactions.statStripValuesOnOtherTab = Array.from(host.querySelectorAll('.sm-stat-strip .sm-f strong'))
    .map((element) => element.textContent)
  interactions.fileTreeDirs = Array.from(host.querySelectorAll('.sm-tree-dir .sm-tree-name')).map((element) => element.textContent)
  interactions.fileTreeFiles = Array.from(host.querySelectorAll('.sm-tree-file .sm-tree-name')).map((element) => element.textContent)
  // Nested folders prove the flat upstream paths were turned into a hierarchy.
  interactions.fileTreeDepth2 = Array.from(host.querySelectorAll('.sm-tree-file'))
    .filter((element) => (element.getAttribute('style') ?? '').includes('padding-left: 40px')).length
  interactions.fileTreeTotals = host.querySelector('.sm-insp-body .sm-body-note')?.textContent ?? null
  interactions.collapseDir = await click('.sm-tree-dir')
  interactions.fileTreeFilesAfterCollapse = host.querySelectorAll('.sm-tree-file').length

  // Clicking a file must show its contents, with a way back to the listing.
  interactions.treeIsButtons = host.querySelectorAll('button.sm-tree-file').length
  // Open the root file explicitly: the `.md` stub body is what proves rendering.
  interactions.openFilePreview = await click('button.sm-tree-file')
  interactions.previewShown = host.querySelector('.sm-preview-head') !== null
  interactions.previewPath = host.querySelector('.sm-preview-path')?.textContent ?? null
  // Markdown renders as elements; anything else stays verbatim in a <pre>.
  interactions.previewMarkdownHeading = host.querySelector('.sm-md h3, .sm-md h4')?.textContent ?? null
  interactions.previewIsVerbatim = host.querySelector('.sm-preview-code') !== null
  interactions.previewTreeHidden = host.querySelectorAll('.sm-tree-row').length === 0
  interactions.backToTree = await click('.sm-preview-head .sm-btn')
  interactions.treeRestored = host.querySelectorAll('.sm-tree-dir').length > 0

  interactions.clickVersions = await clickTab('版本历史')
  interactions.versionRows = host.querySelectorAll('.sm-version-row').length
  interactions.versionLogs = Array.from(host.querySelectorAll('.sm-version-log')).map((element) => element.textContent)
  interactions.updateBlockText = host.querySelector('.sm-insp-body .sm-perm-desc.sm-num')?.textContent ?? null
  // Only the three most recent are shown; the rest fold behind a labelled toggle.
  interactions.versionToggleLabel = host.querySelector('.sm-versions-toggle')?.textContent ?? null
  interactions.expandVersions = await click('.sm-versions-toggle')
  interactions.versionRowsExpanded = host.querySelectorAll('.sm-version-row').length
  interactions.versionToggleLabelExpanded = host.querySelector('.sm-versions-toggle')?.textContent ?? null
  interactions.collapseVersions = await click('.sm-versions-toggle')
  interactions.versionRowsRecollapsed = host.querySelectorAll('.sm-version-row').length
  // Every version row offers its own install, except the one already on disk. Clicking one
  // must actually send the version: a missing `window.confirm` used to swallow this whole
  // path silently, and asserting on the rendered rows alone could not see that.
  interactions.versionInstallButtons = host.querySelectorAll('.sm-version-actions .sm-btn').length
  interactions.versionInstalledBadge = host.querySelector('.sm-version-actions .sm-badge:last-child')?.textContent ?? null
  interactions.versionInstalledBadgeLabels = Array.from(host.querySelectorAll('.sm-version-actions .sm-badge'))
    .map((element) => element.textContent)
  const requestsBeforeVersionInstall = requests.length
  interactions.installOldVersionClicked = await click('.sm-version-actions .sm-btn')
  await act(async () => { await settle() })
  interactions.versionInstallRequests = requests.slice(requestsBeforeVersionInstall)
    .map((entry) => `${entry.method} ${entry.target} ${JSON.stringify(entry.body)}`)
  interactions.versionInstallToast = (host.querySelector('.sm-toast')?.textContent ?? '').slice(0, 120)

  interactions.clickMetrics = await clickTab('指标')
  interactions.metricValues = Array.from(host.querySelectorAll('.sm-stat-card .sm-v')).map((element) => element.textContent)
  // The score is a large float upstream — `75093.51584799575` was measured on a real skill — and printing
  // it in full was unreadable and implied a precision the number does not have. Rounded to an integer
  // with grouped thousands, in both places it appears.
  interactions.metricScore = Array.from(host.querySelectorAll('.sm-stat-card'))
    .find((card) => (card.querySelector('.sm-k')?.textContent ?? '') === '综合评分')
    ?.querySelector('.sm-v')?.textContent ?? null
  interactions.metricScoreHasNoLongTail = /^\d{1,3}(,\d{3})*$/.test(interactions.metricScore ?? '')
  // The 主页 link must point somewhere a person can open. Upstream's `homepage` field names the API
  // host, which answers a browser request with 405 — so the panel has to build the public route
  // from the identifiers. The fixture carries the real, wrong value, so this exercises the fix.
  interactions.metricsHomepage = host.querySelector('.sm-link-out')?.getAttribute('href') ?? null
  interactions.metricsHomepageText = host.querySelector('.sm-link-out')?.textContent ?? null
  interactions.metricsHomepageIsApiHost = /\/\/api\.skillhub\.cn/.test(interactions.metricsHomepage ?? '')
  interactions.metricsHomepageLooksOpenable = /^https:\/\/skillhub\.cn\/skills\//.test(interactions.metricsHomepage ?? '')
  // 指标 must hold the counters and the homepage link, and nothing about safety: that moved to its
  // own tab, and leaving a copy behind would be two places to keep in step.
  interactions.metricsHasNoSafetySection = host.querySelector('.sm-insp-body .sm-safety-vendors') === null
  interactions.metricsHeadings = Array.from(host.querySelectorAll('.sm-insp-body h4')).map((element) => element.textContent)

  // The safety tab, and its own landmark in the tab strip. The drawer is open on the all-benign
  // fixture skill, so both vendors must be listed with a working URL — a queued scan has no URL and
  // must therefore show no link at all.
  const safetyTab = () => Array.from(host.querySelectorAll('.sm-tab'))
    .find((element) => (element.textContent ?? '').trim() === '安全扫描')
  interactions.safetyTabPresent = safetyTab() !== undefined
  interactions.safetyTabLabel = safetyTab()?.textContent ?? null
  // Named 安全扫描, not 安全: a tab called 安全 reads as the panel asserting the skill is safe before
  // it has said anything. This asserts the name, because that is the point of the rename.
  interactions.safetyTabIsNotJustSafe = interactions.safetyTabLabel === '安全扫描'
  interactions.safetyTabHasShield = safetyTab()?.querySelector('svg') !== null
  // The tint marks a passed scan, and the CSS applies it to the shield only (`svg { color: … }`) while
  // the label keeps the neutral tab colour — so a green label can never turn the tab's own name into a
  // verdict. jsdom does not resolve stylesheet rules through getComputedStyle, so the class that
  // carries it is what gets asserted, plus the CSS text that scopes it to the icon.
  interactions.safetyTabMarkedForSafeSkill = safetyTab()?.classList.contains('sm-tab-safe') ?? null
  interactions.safetyTabTintIsIconScoped = (() => {
    const clientSource = readFileSync(
      join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8',
    )
    const rule = /\[data-skill-market\] \.sm-tab\.sm-tab-safe ([^{]*)\{([^}]*)\}/.exec(clientSource)
    if (rule === null) return null
    // The selector must end at an svg, and there must be no rule that tints the tab itself.
    const tintsLabel = /\[data-skill-market\] \.sm-tab\.sm-tab-safe\s*\{/.test(clientSource)
    return rule[1].trim() === 'svg' && tintsLabel === false && rule[2].includes('--sm-ok')
  })()
  interactions.clickSafety = await clickTab('安全扫描')
  // One row per scanning vendor, each stating that vendor's own result. The vendor codes are mapped to
  // the labs' real names, and the mapping is only safe because the set of codes is fixed — every one of
  // 240 sampled skills reports exactly `keen` and `sanbu` (tools/security-vendors.mjs).
  const vendorRow = (row) => ({
    mark: row.querySelector('.sm-safety-mark svg') !== null,
    name: row.querySelector('.sm-safety-label strong')?.textContent ?? '',
    text: row.querySelector('.sm-safety-label span')?.textContent ?? '',
    plain: row.classList.contains('plain'),
    link: row.querySelector('.sm-safety-report')?.getAttribute('href') ?? null,
    linkText: row.querySelector('.sm-safety-report')?.textContent ?? null,
  })
  interactions.detailSafetyVendors = Array.from(host.querySelectorAll('.sm-safety-vendor')).map(vendorRow)
  interactions.detailSafetyVendorNames = interactions.detailSafetyVendors.map((row) => row.name)
  interactions.detailSafetyEveryRowHasMark = interactions.detailSafetyVendors.every((row) => row.mark)
  // The two known labs are named in Chinese; the stub's third vendor has no entry in the table, so it
  // must appear under its own code rather than being dropped.
  interactions.detailSafetyUsesLabNames = interactions.detailSafetyVendorNames.slice(0, 2).join(',') === '科恩实验室,云鼎实验室'
  interactions.detailSafetyKeepsUnknownVendor = interactions.detailSafetyVendorNames.includes('future-lab')
  interactions.detailSafetyAllVendorsListed = interactions.detailSafetyVendors.length === 3
  interactions.detailSafetyRawCodesShown = /keen|sanbu/.test(
    host.querySelector('.sm-safety-vendors')?.textContent ?? '',
  )
  interactions.detailSafetyNote = Array.from(host.querySelectorAll('.sm-body-note'))
    .map((element) => element.textContent)
    .find((text) => text.includes('安全')) ?? null
  interactions.safetyHeadings = Array.from(host.querySelectorAll('.sm-insp-body h4')).map((element) => element.textContent)
  await clickTab('指标')

  // The 权限 tab, which nothing else covers. Each row must carry its own glyph: the icon table
  // falls back to the file icon for any unknown name, so a typo would render *something* and look
  // fine. Comparing against that fallback is therefore the only way to tell a real icon from a
  // missing one — and the two rows named in the report must not share a glyph either.
  interactions.clickPermissions = await clickTab('权限')
  interactions.permissionTitles = Array.from(host.querySelectorAll('.sm-perm-title strong'))
    .map((element) => element.textContent)
  interactions.permissionIconPaths = Array.from(host.querySelectorAll('.sm-perm .sm-perm-ic svg path'))
    .map((element) => element.getAttribute('d') ?? '')
  const fallbackPath = host.querySelector('.sm-perm .sm-perm-ic svg path')?.getAttribute('d') ?? null
  interactions.permissionIconsAllResolved = interactions.permissionIconPaths.length === 3
    && interactions.permissionIconPaths.every((path) => path !== '')
  interactions.permissionIconsDistinct = new Set(interactions.permissionIconPaths).size
    === interactions.permissionIconPaths.length
  // `i-file` is the fallback in the icon table; the metadata row used to be a globe instead.
  interactions.permissionIconsNoFallback = (() => {
    const tree = readFileSync(join(import.meta.dirname, '..', 'lib', 'client.js'), 'utf8')
    const parsed = /\s*'i-file':\s*'([^']+)'/.exec(tree)
    return parsed === null ? null : interactions.permissionIconPaths.includes(parsed[1]) === false
  })()
  void fallbackPath

  // The same section for a skill whose vendors do not all agree, and for one still queued. Neither may
  // draw the badge — and the queued one must offer no report link, because it has no URL, which is the
  // same fault as the API-host homepage link. Both open from the catalog card, not the installed row.
  const openDrawerFor = async (name) => {
    const card = Array.from(host.querySelectorAll('.sm-skill-card'))
      .find((element) => (element.querySelector('.sm-skill-name')?.textContent ?? '') === name)
    if (card === undefined) return false
    await act(async () => {
      card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })
    await clickTab('安全扫描')
    return true
  }
  interactions.openedRisky = await openDrawerFor('育儿大师.Skill')
  interactions.riskyVendors = Array.from(host.querySelectorAll('.sm-safety-vendor')).map(vendorRow)
  // The disagreement must be visible per row: one lab benign, the other suspicious — and only the
  // suspicious row loses its green mark.
  interactions.riskyVerdictTexts = interactions.riskyVendors.map((row) => row.text)
  interactions.riskyPlainFlags = interactions.riskyVendors.map((row) => row.plain)
  interactions.riskyNote = Array.from(host.querySelectorAll('.sm-body-note'))
    .map((element) => element.textContent)
    .find((text) => text.includes('安全')) ?? null
  // A tab tinted green would be the same claim as the badge, so it must not be tinted here.
  interactions.riskyTabTinted = (() => {
    const tab = Array.from(host.querySelectorAll('.sm-tab'))
      .find((element) => (element.textContent ?? '').trim() === '安全扫描')
    return tab?.classList.contains('sm-tab-safe') ?? null
  })()

  interactions.openedQueued = await openDrawerFor('dev-expert')
  interactions.queuedVendors = Array.from(host.querySelectorAll('.sm-safety-vendor')).map(vendorRow)
  interactions.queuedVerdictTexts = interactions.queuedVendors.map((row) => row.text)
  interactions.queuedReportLinks = host.querySelectorAll('.sm-safety-report').length
  // A queued scan still names both labs; it simply has nothing to link to.
  interactions.queuedVendorNames = interactions.queuedVendors.map((row) => row.name)
  interactions.queuedTabTinted = (() => {
    const tab = Array.from(host.querySelectorAll('.sm-tab'))
      .find((element) => (element.textContent ?? '').trim() === '安全扫描')
    return tab?.classList.contains('sm-tab-safe') ?? null
  })()
  // Every rendered safety link must be a real URL, never an empty href.
  interactions.allSafetyLinksAreUrls = Array.from(host.querySelectorAll('.sm-safety-report'))
    .every((anchor) => /^https?:\/\//.test(anchor.getAttribute('href') ?? ''))

  interactions.clickMetricsAgain = await clickTab('指标')
  const close = host.querySelector('.sm-insp-head .sm-icon-btn')
  if (close !== null) {
    await act(async () => {
      close.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await settle()
    })
  }
  interactions.inspectorClosed = host.querySelector('.sm-inspector.open') === null
}

const text = host.textContent ?? ''
const counts = {
  cards: host.querySelectorAll('.sm-skill-card').length,
  featured: host.querySelectorAll('.sm-feat-card').length,
  chips: host.querySelectorAll('.sm-chip').length,
  tags: host.querySelectorAll('.sm-tag').length,
  icons: host.querySelectorAll('.sm-skill-icon').length,
  images: host.querySelectorAll('.sm-skill-icon img').length,
  skeletons: host.querySelectorAll('.sm-skeleton').length,
}

const styleText = window.document.head.querySelector('style')?.textContent ?? ''

/**
 * Where each landmark actually lives. The layout contract is that only the card
 * list scrolls: the page head, the sort control and the category chips must be
 * inside `.sm-fixed`, and the card grid must be inside `.sm-content`, never the
 * other way round.
 */
const fixed = host.querySelector('.sm-fixed')
const content = host.querySelector('.sm-content')
const structure = {
  fixedExists: fixed !== null,
  contentExists: content !== null,
  headInFixed: fixed?.querySelector('.sm-page-head') !== null && fixed?.querySelector('.sm-page-head') !== undefined,
  sortInFixed: fixed?.querySelector('.sm-select-wrap select') !== null && fixed?.querySelector('.sm-select-wrap select') !== undefined,
  chipsInFixed: fixed?.querySelector('.sm-chips') !== null && fixed?.querySelector('.sm-chips') !== undefined,
  gridInContent: content?.querySelector('.sm-grid-cards') !== null && content?.querySelector('.sm-grid-cards') !== undefined,
  headNotInContent: content?.querySelector('.sm-page-head') === null,
  chipsNotInContent: content?.querySelector('.sm-chips') === null,
  topbarOutsideContent: host.querySelector('.sm-topbar')?.closest('.sm-content') === null,
  viewbarOutsideContent: host.querySelector('.sm-viewbar')?.closest('.sm-content') === null,
  contentIsScrollable: styleText.includes('.sm-content { flex: 1; min-height: 0; overflow-y: auto'),
  fixedIsStatic: /\.sm-fixed \{[^}]*flex: 0 0 auto/.test(styleText),
}

const overflowCandidates = []
for (const element of host.querySelectorAll('*')) {
  const rectWidth = Number(element.getBoundingClientRect?.().width ?? 0)
  if (rectWidth > width) overflowCandidates.push({ className: String(element.className), rectWidth })
}

/**
 * The card statistics row, with its icons named.
 *
 * The row changed from words (`2.4M downloads · ★5.0 · 305 saves`, which wrapped in English and made a card's
 * height depend on the language) to icon + number. A text dump cannot show whether the icons are present, so the
 * paths are matched against the bundle's own icon table and reported by name.
 */
const iconNamesByPath = {}
for (const match of bundle.matchAll(/'([a-z][a-z0-9-]+)':\s*'([MmLlHhVvCcSsQqTtAaZz0-9 .,-]+)'/g)) {
  if (match[1].startsWith('i-')) iconNamesByPath[match[2]] = match[1]
}
const cardStats = Array.from(host.querySelectorAll('.sm-stats')).slice(0, 3).map((row) => ({
  text: (row.textContent ?? '').trim(),
  icons: Array.from(row.querySelectorAll('svg path'))
    .map((path) => iconNamesByPath[path.getAttribute('d')] ?? '(unknown)'),
  titles: Array.from(row.querySelectorAll('[title]')).map((element) => element.getAttribute('title')),
}))
// The figures must not carry a word any more: that is what made the row wrap in English. The compact notation
// is stripped before looking for words, because the `M` in `2.4M` is a number suffix and not a label — treating
// it as one reported this row as still carrying text.
const cardStatsWithWords = cardStats
  .map((row, index) => ({
    index,
    text: row.text,
    words: row.text.replace(/[0-9.,·\s]/g, '').replace(/[KMBT]/g, ''),
  }))
  .filter((row) => row.words !== '')
const cardStatsAreIconOnly = cardStatsWithWords.length === 0

/**
 * Any rendered text that is still a dictionary key.
 *
 * This is the symptom the user sees: `misc.vendorKeen` on screen because a table held a key and its consumer
 * returned the value untranslated. Checking the rendered DOM is the only reliable way to catch it — three attempts
 * at scanning the source for "a key used without `t`" each produced wrong answers, because deciding whether a
 * literal is translated requires following it through variables. The rendered text has no such ambiguity.
 *
 * Only *whole* text nodes are compared, so prose that happens to contain a dotted word is not reported.
 */
const dictionaryZh = (await import('../lib/locale.js')).ZH
const untranslatedKeys = (() => {
  const dictionaryKeys = new Set(Object.keys(dictionaryZh))
  const found = new Map()
  const walk = (node) => {
    for (const child of node.childNodes ?? []) {
      if (child.nodeType === 3) {
        const text = (child.textContent ?? '').trim()
        if (dictionaryKeys.has(text)) found.set(text, (found.get(text) ?? 0) + 1)
      } else {
        walk(child)
      }
    }
  }
  walk(host)
  return [...found.entries()].map(([key, count]) => ({ key, count }))
})()

/**
 * The panel's nesting as an indented outline, for the times a yes/no structural check is not enough.
 *
 * A misplaced parenthesis changes nesting while every "is X inside Y?" assertion can still pass, so the
 * actual tree is worth having. Only the elements that place things are listed — anything with an `sm-`
 * class, plus the panel root — to keep the output readable.
 * @param {Element} element - Element to describe.
 * @param {number} depth - Current depth.
 * @param {number} limit - Maximum depth to descend.
 * @returns {string[]} Outline lines.
 */
function outline(element, depth, limit) {
  const pad = '  '.repeat(depth)
  const classes = String(element.className ?? '').split(/\s+/).filter((name) => name.startsWith('sm-'))
  const panel = element.getAttribute('data-skill-market-panel')
  const label = `${element.tagName.toLowerCase()}${classes.length > 0 ? `.${classes.join('.')}` : ''}${panel === null ? '' : `[panel=${panel}]`}`
  const lines = [`${pad}${label}`]
  if (depth >= limit) {
    if (element.children.length > 0) lines.push(`${pad}  … ${String(element.children.length)} more`)
    return lines
  }
  for (const child of element.children) lines.push(...outline(child, depth + 1, limit))
  return lines
}

const domOutline = host.children.length === 0
  ? []
  : outline(host.children[0], 1, 4)

/**
 * The panel's landmark order, asserted directly rather than inferred.
 *
 * This exists because of a real defect: a translation edit left `header.sm-topbar` unclosed, so
 * `div.sm-viewbar` became its *child* instead of its next sibling. The page was misaligned while every
 * existing assertion still passed — `headInFixed`, `chipsInFixed` and `gridInContent` all ask whether an
 * element is inside the right parent, and none of them asks whether it is *outside* the wrong one. Order and
 * parentage are therefore checked here as a single fact.
 *
 * Exported so `landmark-guard-selftest.mjs` can exercise it against synthetic DOMs. Verifying it by mutating
 * this source file was tried and abandoned: a hand-written balanced mutation is easy to get wrong, and each
 * attempt rewrote the real client bundle.
 *
 * @param {Element} root - The panel root element.
 * @returns {{ entries: object[], ok: boolean }} One entry per landmark, and whether all are direct children.
 */
export function landmarkOrderOf(root) {
  const entries = [
    ['header', 'sm-topbar'],
    ['div', 'sm-viewbar'],
    ['div', 'sm-fixed'],
    ['main', 'sm-content'],
    ['div', 'sm-statusbar'],
  ].map(([tag, className]) => {
    const element = root.querySelector(`${tag}.${className}`)
    if (element === null) return { className, found: false }
    const parent = element.parentElement
    return {
      className,
      found: true,
      // The landmark must sit directly under the panel root, not nested inside another landmark.
      directChildOfRoot: parent?.getAttribute('data-skill-market-panel') === 'skill-market',
      parentChain: (() => {
        const chain = []
        let current = parent
        while (current !== null && current.getAttribute?.('data-skill-market-panel') !== 'skill-market') {
          const classes = String(current.className ?? '').split(/\s+/).filter((name) => name.startsWith('sm-'))
          chain.unshift(`${current.tagName.toLowerCase()}${classes.length > 0 ? `.${classes[0]}` : ''}`)
          current = current.parentElement
        }
        return chain.join(' > ')
      })(),
    }
  })
  return { entries, ok: entries.every((entry) => entry.found && entry.directChildOfRoot) }
}

const { entries: landmarkOrder, ok: landmarkOrderOk } = landmarkOrderOf(host)

console.error = originalError

console.log(JSON.stringify({
  structure,
  landmarkOrder,
  landmarkOrderOk,
  cardStats,
  cardStatsAreIconOnly,
  cardStatsWithWords,
  untranslatedKeys,
  domOutline,
  pageUrl,
  viewport: { width, height },
  requests,
  counts,
  styleChars: styleText.length,
  styleHasTokens: styleText.includes('--sm-accent') && styleText.includes('--dsw-alias-brand-primary'),
  styleHasResponsive: styleText.includes('@media (max-width: 920px)') && styleText.includes('@media (max-width: 1024px)'),
  styleHasReducedMotion: styleText.includes('prefers-reduced-motion'),
  errors,
  firstText: text.slice(0, 240),
  hasEmptyState: host.querySelectorAll('.sm-empty').length,
  hasErrorState: host.querySelectorAll('.sm-empty.is-error').length,
  liveText: host.querySelector('.sm-live')?.textContent ?? null,
  statusText: host.querySelector('.sm-statusbar')?.textContent ?? null,
  interactions,
  /** Every request the panel made, compacted, for debugging the write path. */
  requestLog: requests.map((entry) => `${entry.method} ${entry.target.replace(/^.*\/skill-market\/api/, '')}${entry.body === undefined ? '' : ` ${JSON.stringify(entry.body)}`}`),
  layoutNote: 'jsdom performs no layout; overflow must be validated in a real browser',
  reactOverflowCandidates: overflowCandidates.length,
}, null, 2))
