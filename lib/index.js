/**
 * dsh-skill-market — Host half.
 *
 * Two responsibilities, both of which need Node rather than the page:
 *
 *  1. **Proxy.** The market data lives on `api.skillhub.cn`, which answers
 *     browsers with no `Access-Control-Allow-Origin` header, so a page-side
 *     `fetch` cannot read it. This half owns one same-origin prefix route and
 *     proxies the read-only SkillHub endpoints, with a short in-memory cache.
 *
 *  2. **Install.** Clicking 安装 downloads the skill's whole file bundle from
 *     SkillHub, validates every path and every byte, and writes it under
 *     `$DSH_HOME/skills`. Each installed skill is then published to `ctx.skills`
 *     as a **live runtime registration**, which is what makes install, enable and
 *     disable take effect in the running session with no restart.
 *
 *     A runtime registration is the live mechanism: `ctx.skills.register()` is
 *     visible to the next model step and returns the exact disposer that removes
 *     it again, so the panel's enable switch maps onto register/dispose. The
 *     alternative — a *provider*, whose catalog is only re-read when something
 *     calls its `invalidate()` — looks equivalent but is not: in a profile with no
 *     file-watching skill provider mounted, nothing ever invalidates it, so a
 *     newly installed skill stays invisible until the next process start. That is
 *     exactly the trap this file used to fall into.
 *
 * @module dsh-skill-market
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, cp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

/** Same-origin prefix the browser half calls. */
const ROUTE_PREFIX = '/skill-market/api'

/** Upstream origin; the site's own bundle resolves `skillhub.cn` to this host. */
const UPSTREAM = 'https://api.skillhub.cn'

/**
 * Directories the plugin keeps beside its own package.
 *
 * `lib/index.js` is one level inside the package, so the package root is its parent.
 * Resolved from the module URL rather than a hard-coded path, so the directory
 * follows the package wherever it is installed. There is no `import.meta.dirname`
 * on every Node the harness may be hosted on, so the URL is converted explicitly.
 */
const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)))

/** How long a successful upstream response stays warm. */
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Cap on cached distinct queries, oldest evicted first.
 *
 * Sized for the security badge rather than for a single page. That badge lives only in the detail
 * response, so a screen of 60 cards costs 60 detail fetches — and a list page is 97 KB against 2.3 KB
 * for a detail, so a cap of 64 would evict the list the cards came from and refetch it on the next
 * scroll. Entries are small text, so a few hundred of them is cheap.
 */
const CACHE_MAX_ENTRIES = 512

/** Passed through from the client query string, each with its upstream name. */
const SKILL_QUERY_KEYS = ['page', 'pageSize', 'sortBy', 'order', 'keyword', 'category', 'source', 'labels']

/**
 * The skill-name grammar, copied from the registry that enforces it.
 *
 * Must match `@deepseek-ai/dsh-skill`'s `SKILL_NAME` exactly: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Lowercase
 * only, and single hyphens between runs — so `a--b` is invalid, as is anything with a space, a
 * parenthesis or a non-ASCII character.
 *
 * The point of duplicating the pattern is to fail **at install time**. The registry validates on load,
 * so a package whose `SKILL.md` says `name: Playwright (Automation + MCP + Scraper)` installs
 * successfully, lands on disk, and then never appears — the user sees a skill they installed and cannot
 * invoke, which reads as a broken plugin rather than a broken package.
 */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Reject a bundle whose declared skill name the registry would refuse.
 * @param {string} name - `name` from a `SKILL.md` frontmatter block.
 * @throws {Error} With the offending value, so the publisher's mistake is visible.
 */
function assertSkillName(name) {
  if (SKILL_NAME.test(name) === false) {
    throw new Error(
      `该技能包的 SKILL.md 里 name 不是 kebab-case（只允许小写字母、数字、单个连字符）：`
      + `${String(name).slice(0, 60)}。这是发布方的问题，Harness 会忽略这个技能文件。`,
    )
  }
}

/** Page-size guard: the upstream accepts more, but the panel never needs it. */
const MAX_PAGE_SIZE = 100

/* ── install limits ──────────────────────────────────────────────────────
 * A skill is an arbitrary archive from a public community site. Every limit
 * below exists so one install cannot exhaust memory, disk, or the user's
 * patience; the numbers are generous for real skills (the largest on the front
 * page is about 1 MB over 84 files) and still bound the damage.
 */

/** Largest single file accepted, in bytes. */
const MAX_FILE_BYTES = 8 * 1024 * 1024
/** Ceiling for a text preview served to the drawer; larger files are reported, not sent. */
const MAX_PREVIEW_BYTES = 256 * 1024
/** Ceiling for the `path` a preview request may name. */
const MAX_PREVIEW_PATH = 400
/** Largest whole skill accepted, in bytes. */
const MAX_TOTAL_BYTES = 64 * 1024 * 1024
/** Largest file count accepted. */
const MAX_FILES = 2000
/** Concurrent file downloads. */
const DOWNLOAD_CONCURRENCY = 6
/** Largest archive accepted for a local import, in bytes. */
const MAX_IMPORT_BYTES = 50 * 1024 * 1024
/** Directory-name prefix that marks a locally imported skill, matching the client's `local-` ids. */
const LOCAL_HANDLE = 'local'

/** Services this plugin needs; `skills` is optional so a profile without the registry still serves data. */
export const inject = ['webServer']

/**
 * @typedef {object} CacheEntry
 * @property {number} expiresAt - Epoch milliseconds after which the entry is stale.
 * @property {number} status - Upstream HTTP status.
 * @property {string} body - Upstream response text.
 */

/** Warm responses keyed by the exact upstream URL. @type {Map<string, CacheEntry>} */
const cache = new Map()

/**
 * Read one cached response if it is still warm.
 * @param {string} key - Cache key.
 * @returns {CacheEntry | undefined} The entry, or `undefined` when stale or absent.
 */
function cacheGet(key) {
  const entry = cache.get(key)
  if (entry === undefined) return undefined
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  cache.delete(key)
  cache.set(key, entry)
  return entry
}

/**
 * Store one successful response and evict the oldest entry past the cap.
 * @param {string} key - Cache key.
 * @param {CacheEntry} entry - Entry to store.
 * @returns {void}
 */
function cacheSet(key, entry) {
  cache.set(key, entry)
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.done === true) break
    cache.delete(oldest.value)
  }
}

/**
 * Answer a request from the browser half.
 * @param {import('node:http').ServerResponse} res - Response to own.
 * @param {number} status - HTTP status to send.
 * @param {string} body - Response body text.
 * @param {Record<string, string>} [headers] - Extra response headers.
 * @returns {void}
 */
function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  })
  res.end(body)
}

/**
 * Send one JSON value.
 * @param {import('node:http').ServerResponse} res - Response to own.
 * @param {number} status - HTTP status.
 * @param {unknown} value - JSON-serialisable payload.
 * @returns {void}
 */
function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value))
}

/**
 * Send one JSON error the client can surface directly.
 * @param {import('node:http').ServerResponse} res - Response to own.
 * @param {number} status - HTTP status to send.
 * @param {string} message - Human-readable reason.
 * @returns {void}
 */
function sendError(res, status, message) {
  sendJson(res, status, { error: message })
}

/* ── upstream reads ─────────────────────────────────────────────────────── */

/**
 * Build the upstream URL for the skill list, forwarding only known parameters
 * and clamping the page size.
 * @param {URL} url - The incoming request URL.
 * @returns {string} Absolute upstream URL.
 */
function skillsUpstreamUrl(url) {
  const params = new URLSearchParams()
  for (const key of SKILL_QUERY_KEYS) {
    const value = url.searchParams.get(key)
    if (value === null || value.trim() === '') continue
    if (key === 'pageSize' || key === 'page') {
      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) continue
      params.set(key, String(key === 'pageSize' ? Math.min(parsed, MAX_PAGE_SIZE) : parsed))
      continue
    }
    params.set(key, value)
  }
  if (!params.has('page')) params.set('page', '1')
  if (!params.has('pageSize')) params.set('pageSize', '24')
  if (!params.has('sortBy')) params.set('sortBy', 'score')
  return `${UPSTREAM}/api/skills?${params.toString()}`
}

/**
 * Fetch one upstream URL with a warm cache and a hard timeout.
 * @param {string} target - Absolute upstream URL.
 * @returns {Promise<{entry: CacheEntry, cache: 'warm'|'miss'}>} Status and body, from cache when warm.
 */
async function fetchUpstream(target) {
  const warm = cacheGet(target)
  if (warm !== undefined) return { entry: warm, cache: 'warm' }

  const response = await fetch(target, {
    headers: {
      accept: 'application/json',
      'user-agent': '@montersy123/dsh-skill-market/0.1 (+https://skillhub.cn)',
    },
    signal: AbortSignal.timeout(15_000),
  })
  const body = await response.text()
  const entry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    status: response.status,
    body,
  }
  if (response.ok) cacheSet(target, entry)
  return { entry, cache: 'miss' }
}

/* ── install: paths, names, and safety ──────────────────────────────────── */

/** DSH config root; its `skills` child is the harness-wide local skill root. */
function dshHome() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/**
 * The skill root this plugin installs into: the harness's own `$DSH_HOME/skills`.
 *
 * Using the stock root makes an installed skill an ordinary local skill — the
 * built-in filesystem provider finds it (`user-dsh`, rank 400), the Skills UI
 * lists it beside hand-written skills, and it outlives this plugin being
 * disabled. SkillHub names are Chinese and `.`-separated while a skill name must
 * be kebab-case, so each skill lands in a directory named `<publisher>--<slug>`
 * — flat, with no plugin-specific wrapper directory.
 *
 * `DSH_SKILL_MARKET_ROOT` overrides it, which is how the contract test installs
 * into a scratch directory instead of the user's real skill root.
 *
 * `DSH_SKILL_MARKET_TEST_ONLY` turns that override into a requirement: with it set, any
 * attempt to resolve the real root throws. That guard exists because of a measured
 * accident — a scratch root assigned after `import` is ignored, since ES module imports
 * hoist above the assignment, so several check scripts installed a real skill over the
 * user's pinned release while believing they were sandboxed. Failing loudly is the only
 * reliable fix; a comment asking for correct ordering was already ignored three times.
 *
 * @returns {string} Absolute root directory.
 * @throws {Error} When test-only mode is on and no scratch root is set.
 */
function skillRoot() {
  const override = process.env.DSH_SKILL_MARKET_ROOT
  const testOnly = String(process.env.DSH_SKILL_MARKET_TEST_ONLY ?? '').trim() !== ''
  if (override === undefined || override.trim() === '') {
    if (testOnly) {
      throw new Error('DSH_SKILL_MARKET_TEST_ONLY 已设置但没有 DSH_SKILL_MARKET_ROOT：拒绝把测试写到真实技能目录')
    }
    return join(dshHome(), 'skills')
  }
  return resolve(override)
}

/**
 * The old, plugin-private skill root this version no longer reads.
 * @returns {string} Absolute directory.
 */
function legacySkillRoot() {
  return join(dshHome(), 'skill-market', 'skills')
}

/**
 * Where this plugin keeps its own state.
 *
 * `$DSH_HOME/storages/@montersy123/dsh-skill-market/data`. Three deliberate choices:
 *
 *   **Outside the package.** State used to live in `<package>/data`, where any replacement of
 *   the package deleted it — `pnpm install`, a hand reinstall, an interrupted upgrade, and this
 *   plugin's own installer all replace that directory, so every parked skill silently came back
 *   enabled and every version label was lost. Saving and restoring around an install is a
 *   workaround that only holds while everyone remembers to do it.
 *
 *   **In `$DSH_HOME/storages`, where DSH keeps plugin-owned state.** The cost meter's ledger lives
 *   in `storages/cost-meter`, so this is an existing place rather than a new one, and the profile
 *   directory stops accumulating a package-shaped folder of ours.
 *
 *   **Named by the package's two segments** — `@montersy123`, then `dsh-skill-market` — so the path
 *   says which package owns the directory, with the scope as a level instead of a separator
 *   flattened into the name.
 *
 * Nothing older is read. The directory has settled, and a store left where an earlier build put it
 * is simply a directory nobody reads; moving it by hand is the upgrade step.
 *
 * `DSH_SKILL_MARKET_ROOT` moves it for tests, laying it beside the scratch skill root so a
 * test run never touches the real state.
 *
 * @returns {string} Absolute directory.
 * @throws {Error} When test-only mode is on and no scratch root is set.
 */
function pluginDataRoot() {
  const override = process.env.DSH_SKILL_MARKET_ROOT
  if (override === undefined || override.trim() === '') {
    if (String(process.env.DSH_SKILL_MARKET_TEST_ONLY ?? '').trim() !== '') {
      throw new Error('DSH_SKILL_MARKET_TEST_ONLY 已设置但没有 DSH_SKILL_MARKET_ROOT：拒绝把测试写到真实插件数据目录')
    }
    return join(pluginStateRoot(), 'data')
  }
  return join(dirname(resolve(override)), 'skill-market-data')
}

/** This plugin's storage path inside `$DSH_HOME/storages`: the scope, then the package name. */
const STORAGE_SEGMENTS = ['@montersy123', 'dsh-skill-market']

/**
 * The directory inside {@link pluginDataRoot} that holds disabled skills.
 *
 * Named `skills` because that is what it contains: the skill directories whose switch is off. Only one
 * root is scanned by the Harness — `$DSH_HOME/skills`, where a skill is on — so a disabled skill's
 * files sit here until it is enabled again, and the directory *is* the record: enabled means the files
 * are in the harness root, disabled means they are here.
 *
 * Read and written under this one name, with no older spelling kept for compatibility: this plugin's
 * directory names have settled, so a store left under a previous name is not adopted. It is simply
 * another directory nobody reads.
 */
const PARKED_DIRECTORY = 'skills'


/**
 * This plugin's state directory: `$DSH_HOME/storages/@montersy123/dsh-skill-market`.
 * @returns {string} Absolute directory.
 */
function pluginStateRoot() {
  return join(dshHome(), 'storages', ...STORAGE_SEGMENTS)
}

/**
 * Where the plugin's state lived before it moved out of the package entirely.
 *
 * Read only by the one migration that still has work to do — a build that *marked* a skill disabled in
 * a state file instead of moving its directory. Nothing else uses this path.
 * @returns {string} Absolute directory.
 */
function legacyPluginRoot() {
  return join(dshHome(), 'skill-market')
}

/**
 * Move skills installed by an earlier version into the shared root.
 *
 * Early builds wrote to `$DSH_HOME/skill-market/skills`, which nothing discovers
 * any more (and which is exactly the wrapper level that made the location hard to
 * reason about). Anything already there is moved up so an installed skill is not
 * silently lost; an existing destination is left alone rather than overwritten.
 *
 * @returns {Promise<string[]>} Names that were moved.
 */
async function migrateLegacyRoot() {
  const legacy = legacySkillRoot()
  const current = skillRoot()
  if (legacy === current || !existsSync(legacy)) return []
  const moved = []
  for (const entry of await readdir(legacy, { withFileTypes: true })) {
    if (entry.isDirectory() === false) continue
    const from = join(legacy, entry.name)
    const to = join(current, entry.name)
    if (existsSync(to)) continue
    await mkdir(current, { recursive: true })
    await rename(from, to)
    moved.push(entry.name)
  }
  if (moved.length > 0) {
    // Leave no empty wrapper behind once everything has been moved out.
    await rm(legacy, { recursive: true, force: true })
    await rm(dirname(legacy), { recursive: true, force: true })
  }
  return moved
}

/**
 * Reduce an upstream publisher or slug to a safe single path segment.
 * @param {string} value - Untrusted text.
 * @param {string} fallback - Used when nothing usable remains.
 * @returns {string} A `[a-z0-9-]` segment, at most 64 characters.
 */
function safeSegment(value, fallback) {
  const cleaned = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return cleaned === '' ? fallback : cleaned
}

/**
 * Validate one of this plugin's own directory names.
 *
 * Distinct from {@link safeSegment}, which *rewrites* untrusted text and would
 * therefore collapse the `--` in `<handle>--<slug>` and silently address the
 * wrong directory. This accepts only the shape `targetFor` produces and rejects
 * everything else, so an uninstall can never be aimed somewhere unintended.
 *
 * @param {string} value - Requested directory name.
 * @returns {string} The validated name.
 * @throws {Error} When the name is not one this plugin could have created.
 */
function safeDirectoryName(value) {
  const name = String(value ?? '').trim()
  if (name === '' || name.length > 128) throw new Error('技能名长度不合法')
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`技能名不合法：${name.slice(0, 60)}`)
  if (name.includes('..')) throw new Error('拒绝包含 .. 的技能名')
  return name
}

/**
 * Validate a directory name that is already known to exist in one of the roots.
 *
 * Weaker than {@link safeDirectoryName} on purpose: that one only accepts the shape this plugin
 * writes, which is right when *choosing* a name. But a user may place their own skill folder in a
 * root, and they name it however they like — `libai-1.0.5` is a real example. Refusing to toggle or
 * remove a directory the scanner itself just reported is worse than useless: the skill is listed,
 * and every action on it fails with "技能名不合法".
 *
 * What is still enforced is what actually matters: a single path segment that cannot escape the
 * root it belongs to. That means no separators, no `..`, no reserved Windows names, and no
 * trailing dot or space (which Windows silently strips, so it would name a different file than it
 * appears to).
 *
 * @param {string} value - Directory name reported by the scan or sent by the client.
 * @returns {string} The validated name.
 * @throws {Error} When the value is not a usable single segment.
 */
function safeExistingDirectoryName(value) {
  const name = String(value ?? '').trim()
  if (name === '' || name.length > 128) throw new Error('技能名长度不合法')
  if (name === '.' || name.includes('..')) throw new Error(`技能名不合法：${name.slice(0, 60)}`)
  if (/[/\\]/.test(name)) throw new Error(`技能名不能包含路径分隔符：${name.slice(0, 60)}`)
  if (/[:*?"<>|\u0000-\u001f]/.test(name)) throw new Error(`技能名含非法字符：${name.slice(0, 60)}`)
  if (/[. ]$/.test(name)) throw new Error(`技能名不能以点或空格结尾：${name.slice(0, 60)}`)
  const stem = name.split('.')[0].toUpperCase()
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem)) throw new Error(`技能名是 Windows 保留名：${name.slice(0, 60)}`)
  return name
}

/**
 * Derive the directory and skill name for one skill.
 *
 * A skill name must be kebab-case, so a Chinese display name cannot be used
 * as-is; `handle--slug` is stable, unique per publisher, and survives a rename
 * of the display name.
 *
 * @param {{namespace?: string, slug?: string, name?: string}} request - Install request fields.
 * @returns {{name: string, dir: string}} Skill name and absolute directory.
 */
function targetFor(request) {
  const handle = safeSegment(request.namespace, 'skillhub')
  const slug = safeSegment(request.slug, safeSegment(request.name, 'skill'))
  const name = `${handle}--${slug}`.slice(0, 128)
  // Where a fresh install goes, unless this skill is already parked — then it stays parked,
  // because installing must not quietly re-enable it. The decision itself lives in
  // `locateInstalled`, so install and uninstall can never disagree about where a skill is.
  const located = locateInstalled(name)
  if (located !== undefined && located.enabled === false) {
    return { name, dir: located.dir, enabled: false }
  }
  return { name, dir: join(skillRoot(), name), enabled: true }
}

/**
 * Validate one upstream file path and resolve it inside the skill directory.
 *
 * Upstream paths are attacker-controlled, so this rejects absolute paths,
 * drive letters, UNC prefixes, backslashes, `..` segments, and anything that
 * escapes the root after normalisation. Returning the resolved path (rather
 * than a boolean) keeps the containment check and the write on the same value.
 *
 * @param {string} root - The skill's own directory.
 * @param {string} filePath - Upstream path such as `hooks/backup.py`.
 * @returns {string} The absolute destination path.
 * @throws {Error} When the path is unusable or escapes the root.
 */
function resolveInside(root, filePath) {
  const raw = String(filePath ?? '')
  if (raw === '' || raw.length > 400) throw new Error(`文件路径不合法：${raw.slice(0, 80)}`)
  if (raw.startsWith('/') || raw.startsWith('\\') || /^[A-Za-z]:/.test(raw)) throw new Error(`拒绝绝对路径：${raw}`)
  if (raw.includes('\\')) throw new Error(`拒绝反斜杠路径：${raw}`)
  if (raw.includes('\0')) throw new Error('文件路径含空字节')
  const normalised = raw.split('/').filter((segment) => segment !== '' && segment !== '.')
  if (normalised.length === 0 || normalised.some((segment) => segment === '..')) {
    throw new Error(`拒绝越界路径：${raw}`)
  }
  const target = resolve(root, ...normalised)
  const rootResolved = resolve(root)
  if (target !== rootResolved && !target.startsWith(rootResolved + sep)) throw new Error(`路径逃出技能目录：${raw}`)
  return target
}

/* ── install: the operation itself ──────────────────────────────────────── */

/**
 * Fetch one upstream file as bytes, with a size ceiling.
 *
 * `version` is optional and must be echoed to upstream. Without it the endpoint answers
 * with the **latest** release, whatever the caller asked for — verified against
 * `dev-expert`: the versioned request returned 15557 bytes matching the declared sha256,
 * while the unversioned one returned 15020 bytes for the same path. So an install of an
 * older version that omitted it would silently mix releases and fail the checksum.
 *
 * @param {string} slug - Skill slug.
 * @param {string} namespace - Publisher handle.
 * @param {string} filePath - Path inside the skill bundle.
 * @param {number} declaredSize - Size the file list declared, when known.
 * @param {string} [version] - Release to read; latest when omitted.
 * @returns {Promise<Buffer>} File bytes.
 * @throws {Error} When the fetch fails or the file is too large.
 */
async function fetchFile(slug, namespace, filePath, declaredSize, version) {
  if (typeof declaredSize === 'number' && declaredSize > MAX_FILE_BYTES) {
    throw new Error(`文件过大（${Math.round(declaredSize / 1024)} KB）：${filePath}`)
  }
  const params = new URLSearchParams({ path: filePath, namespace })
  if (typeof version === 'string' && version !== '') params.set('version', version)
  const response = await fetch(`${UPSTREAM}/api/v1/skills/${encodeURIComponent(slug)}/file?${params.toString()}`, {
    headers: { 'user-agent': '@montersy123/dsh-skill-market/0.1 (+https://skillhub.cn)' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）：${filePath}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`文件过大（${bytes.byteLength} 字节）：${filePath}`)
  return bytes
}

/**
 * Download and install one skill, at the latest release or a named one.
 *
 * The write is staged: every file lands under `<dir>.installing`, and a
 * successful run swaps that directory into place with one replace, so a failed
 * or interrupted install never leaves a half-written skill in the catalog, and
 * installing a different version over an existing one is the same operation.
 * The published name and description come from the downloaded `SKILL.md`
 * frontmatter, never from the client, so the catalog entry describes the bytes
 * that actually landed.
 *
 * A skill that is currently disabled is written back into the disabled store, so
 * installing does not quietly re-enable it — the result reports `enabled: false` for
 * that case. Disabled state is a location, so honouring it is a matter of not moving
 * the files back.
 *
 * @param {{slug: string, namespace: string, name?: string, version?: string}} request - Install request; `version` selects a release, latest when omitted.
 * @param {(progress: {phase: string, done: number, total: number}) => void} [onProgress] - Progress sink.
 * @returns {Promise<object>} Install result for the client.
 */
async function installSkill(request, onProgress) {
  const slug = String(request.slug ?? '').trim()
  const namespace = String(request.namespace ?? '').trim()
  const version = String(request.version ?? '').trim()
  if (slug === '' || namespace === '') throw new Error('安装请求缺少 slug 或 namespace')

  const { name, dir, enabled } = targetFor({ namespace, slug, name: request.name })
  const staging = `${dir}.installing`

  onProgress?.({ phase: 'listing', done: 0, total: 0 })
  const params = new URLSearchParams({ namespace })
  if (version !== '') params.set('version', version)
  const listed = await fetch(`${UPSTREAM}/api/v1/skills/${encodeURIComponent(slug)}/files?${params.toString()}`, {
    headers: { 'user-agent': '@montersy123/dsh-skill-market/0.1 (+https://skillhub.cn)' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!listed.ok) throw new Error(`无法获取文件清单（HTTP ${listed.status}）`)
  const listing = await listed.json()
  const files = Array.isArray(listing?.files) ? listing.files : []
  // Upstream reports which release the listing describes; an unknown version never
  // reaches here (it is a 404 above), so this is the version actually being written.
  const resolvedVersion = String(listing?.version ?? version)
  if (files.length === 0) throw new Error('该技能没有可下载的文件')
  if (files.length > MAX_FILES) throw new Error(`文件数超出上限（${files.length} > ${MAX_FILES}）`)

  const declaredTotal = files.reduce((sum, file) => sum + (Number(file?.size) || 0), 0)
  if (declaredTotal > MAX_TOTAL_BYTES) {
    throw new Error(`技能体积超出上限（${Math.round(declaredTotal / 1024 / 1024)} MB > ${MAX_TOTAL_BYTES / 1024 / 1024} MB）`)
  }
  if (!files.some((file) => String(file?.path ?? '') === 'SKILL.md')) {
    throw new Error('该技能包缺少 SKILL.md，无法被 Harness 识别为技能')
  }

  // Stage from scratch: a previous failed attempt must not contribute files.
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })

  const written = []
  let index = 0
  let totalBytes = 0
  /**
   * One worker: claim the next path, download it, verify it, write it.
   * @returns {Promise<void>} Resolves when the queue is drained.
   */
  const worker = async () => {
    for (;;) {
      const current = index
      index += 1
      if (current >= files.length) return
      const file = files[current]
      const filePath = String(file?.path ?? '')
      const destination = resolveInside(staging, filePath)
      const bytes = await fetchFile(slug, namespace, filePath, Number(file?.size), version)
      totalBytes += bytes.byteLength
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error('技能体积超出上限，已中止安装')
      const declaredHash = typeof file?.sha256 === 'string' ? file.sha256.toLowerCase() : ''
      if (declaredHash !== '') {
        const actual = createHash('sha256').update(bytes).digest('hex')
        if (actual !== declaredHash) throw new Error(`文件校验失败（sha256 不一致）：${filePath}`)
      }
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, bytes)
      written.push({ path: filePath, size: bytes.byteLength })
      onProgress?.({ phase: 'downloading', done: written.length, total: files.length })
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, files.length) }, worker))
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }

  const instruction = await readFile(join(staging, 'SKILL.md'), 'utf8')
  const frontmatter = parseFrontmatter(instruction)
  if (frontmatter.name === undefined || frontmatter.description === undefined) {
    await rm(staging, { recursive: true, force: true })
    throw new Error('该技能的 SKILL.md 缺少 name 或 description，无法被 Harness 识别')
  }
  // Same grammar the registry enforces on load. Without this the package installs, occupies a
  // directory, and then silently never appears in any conversation.
  try {
    assertSkillName(frontmatter.name)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }

  await swapIntoPlace(staging, dir)

  // The store is permanent, so make sure it exists even when nothing is parked: this install
  // may be the first thing that ever wrote to the state tree, and an empty directory that is
  // there beats one that appears only once something is disabled.
  await ensureStateTree()
  // The only place that knows which release was requested is here, so it is written down:
  // the package's own `version:` field may not match its files, and the files carry no
  // version at all.
  await recordInstalledVersion(name, resolvedVersion, { namespace, slug })

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    directory: dir,
    files: written.length,
    bytes: totalBytes,
    version: resolvedVersion,
    source: { slug, namespace },
    // Whether the skill is now live. A reinstall over a parked skill stays parked, so the
    // panel must not claim it was enabled.
    enabled,
  }
}

/**
 * Parse the small YAML subset a SKILL.md frontmatter uses.
 *
 * The registry only validates when a skill is *loaded*, so a `name` that is not
 * kebab-case, or a missing description, would install silently and then never
 * appear. Reading those fields here turns that into an install-time error the
 * user can see. This is intentionally not a general YAML parser: it handles
 * `key: value`, quoted values, and folded continuations, which is what skills use.
 *
 * @param {string} text - Full SKILL.md contents.
 * @returns {{name?: string, description?: string, whenToUse?: string, invocation?: {modelInvocable: boolean, userInvocable: boolean}}} Parsed fields.
 */
function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (match === null) return {}
  /** @type {Record<string, string>} */
  const fields = {}
  let current = null
  for (const line of match[1].split(/\r?\n/)) {
    const keyed = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (keyed !== null) {
      current = keyed[1]
      fields[current] = keyed[2].trim().replace(/^["']|["']$/g, '')
      continue
    }
    // A folded/continued scalar: append to the previous key.
    if (current !== null && /^\s+\S/.test(line)) fields[current] = `${fields[current]} ${line.trim()}`
  }
  const name = fields.name?.trim()
  const description = fields.description?.trim()
  const whenToUse = fields.whenToUse?.trim()
  return {
    ...(name === undefined || name === '' ? {} : { name }),
    ...(description === undefined || description === '' ? {} : { description }),
    ...(whenToUse === undefined || whenToUse === '' ? {} : { whenToUse }),
    invocation: invocationOf(fields),
  }
}

/**
 * Resolve a skill's invocation policy from its frontmatter.
 *
 * A provider candidate that omits this field is accepted by the registry, but one
 * that carries a malformed object fails candidate validation — and that failure
 * aborts the whole `ctx.skills.list()` call, which empties the entire skill
 * catalog rather than skipping one skill. So this always returns a complete,
 * well-typed policy.
 *
 * @param {Record<string, string>} fields - Parsed frontmatter fields.
 * @returns {{modelInvocable: boolean, userInvocable: boolean}} Resolved policy.
 */
function invocationOf(fields) {
  return {
    modelInvocable: !parseSkillBoolean(fields['disable-model-invocation']),
    userInvocable: fields['user-invocable'] === undefined ? true : parseSkillBoolean(fields['user-invocable']),
  }
}

/**
 * Read one of the skill frontmatter's boolean spellings.
 * @param {string | undefined} value - Raw frontmatter value.
 * @returns {boolean} The value, defaulting to false when absent or unreadable.
 */
function parseSkillBoolean(value) {
  if (value === undefined) return false
  return ['true', 'yes', 'on', '1'].includes(String(value).trim().toLowerCase())
}

/**
 * Move a fully downloaded staging directory into its final place.
 *
 * Reinstalling over an existing skill cannot be a plain folder replace on
 * Windows: `rename` fails with EPERM while any process still holds a handle
 * inside the destination — the running Harness may have the current `SKILL.md`
 * open, an editor may be watching the tree, and an indexer may be mid-scan. So
 * the destination is removed first and the rename is retried briefly, which
 * covers both the transient-lock case and the freshly-created-directory case.
 *
 * The staging directory is verified before this runs, so a failure here leaves a
 * complete `.installing` tree on disk rather than a half-written skill.
 *
 * @param {string} staging - The completed `<dir>.installing` directory.
 * @param {string} dir - The destination.
 * @returns {Promise<void>} Resolves once the swap is complete.
 * @throws {Error} When the destination cannot be replaced after the retries.
 */
async function swapIntoPlace(staging, dir) {
  await mkdir(dirname(dir), { recursive: true })
  let lastError
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 })
      await rename(staging, dir)
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }
  throw new Error(
    `无法替换已存在的技能目录（可能被其它程序占用，请关闭正在使用该目录的程序后重试）：${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

/**
 * Move skills an earlier build only *marked* as disabled into the disabled store.
 *
 * That build recorded the decision in a state file and left the files in the
 * skills root, which meant a disabled skill stayed discoverable by the harness's
 * own provider. The state file is gone now — location is the state — so anything
 * it listed has to be moved, or it would silently switch back on.
 *
 * @returns {Promise<string[]>} Directory names that were parked.
 */
async function migrateDisabledMarks() {
  const override = process.env.DSH_SKILL_MARKET_ROOT
  const legacyState = override === undefined || override.trim() === ''
    ? join(legacyPluginRoot(), 'state.json')
    : join(dirname(resolve(override)), 'skill-market-state.json')
  if (!existsSync(legacyState)) return []
  let listed = []
  try {
    const parsed = JSON.parse(await readFile(legacyState, 'utf8'))
    listed = Array.isArray(parsed?.disabled) ? parsed.disabled : []
  } catch {
    listed = []
  }
  const parked = []
  for (const entry of listed) {
    if (typeof entry !== 'string') continue
    const name = relative(skillRoot(), resolve(entry))
    if (name === '' || name.startsWith('..')) continue
    const from = join(skillRoot(), name)
    if (!existsSync(from)) continue
    await moveSkillDirectory(from, join(disabledRoot(), name))
    parked.push(name)
  }
  await rm(legacyState, { force: true })
  return parked
}

/**
 * Whether a directory exists and holds nothing.
 *
 * Used to decide that a store directory carries no state: an empty
 * `<plugin>/data/skills` means "nothing is disabled", so it is indistinguishable from
 * no directory at all and should not be left behind as clutter that looks like state.
 *
 * @param {string} directory - Directory to test.
 * @returns {Promise<boolean>} Whether it exists and is empty.
 */
async function isDirectoryEmpty(directory) {
  if (!existsSync(directory)) return true
  try {
    return (await readdir(directory)).length === 0
  } catch {
    return false
  }
}

/**
 * Backfill the upstream namespace into install records written before identity was recorded.
 *
 * Every install recorded only `{version, at}`, so the drawer reconstructed upstream identifiers from
 * the directory name — which is lossy, because `safeSegment` rewrites `_` to `-`. Skills already on
 * disk therefore still point at a namespace that does not exist, and their detail page still cannot
 * load. This repairs them once.
 *
 * **Candidate probing, not search.** The first attempt used the catalogue's keyword search for the
 * slug, which is wrong: that endpoint ranks by popularity, and a skill outside the top results is
 * invisible to it — measured on a real record, `find-skills` did not appear in the top 20 for its own
 * slug, so the repair silently failed on the very record that needed it. Probing the detail endpoint
 * for a few spellings of the namespace has no ranking to lose to, and `404` is already its answer for
 * "no such namespace".
 *
 * Candidates, in order: the directory spelling as-is, the same with `-` back to `_`, both with the
 * handle's own `-` removed first (a namespace `clawhub_root` writes the directory `clawhub-root`, so
 * neither candidate alone is enough), and finally the catalogue's keyword search as a last resort —
 * which can still recover a slug that appears nowhere in the directory name.
 *
 * Best effort by design: it runs at activation, never throws, and leaves a record alone when it cannot
 * resolve one. A skill whose namespace cannot be recovered still works — only its detail view is
 * affected, which is exactly how it behaved before this fix.
 *
 * @param {typeof fetch} [fetchImpl] - Injected for testing.
 * @returns {Promise<{repaired: string[], unresolved: string[]}>} What was recovered, and what was not.
 */
async function repairInstallIdentity(fetchImpl = fetch) {
  const repaired = []
  const unresolved = []
  const headers = {
    accept: 'application/json',
    'user-agent': '@montersy123/dsh-skill-market/0.1 (+https://skillhub.cn)',
  }
  /** Does this namespace publish this slug? */
  const namespacePublishes = async (namespace, slug) => {
    if (namespace === '') return false
    try {
      const response = await fetchImpl(
        `${UPSTREAM}/api/v1/skills/${encodeURIComponent(slug)}?namespace=${encodeURIComponent(namespace)}`,
        { headers, signal: AbortSignal.timeout(15_000) },
      )
      return response.status === 200
    } catch {
      return false
    }
  }
  /** Last resort: ask the catalogue, which is the only way to learn an unrelated namespace. */
  const namespaceFromCatalogue = async (slug, guess) => {
    try {
      const response = await fetchImpl(
        `${UPSTREAM}/api/skills?page=1&pageSize=20&sortBy=score&order=desc&keyword=${encodeURIComponent(slug)}`,
        { headers, signal: AbortSignal.timeout(15_000) },
      )
      if (response.ok === false) return ''
      const body = await response.json()
      const matches = (body?.data?.skills ?? []).filter((entry) => String(entry?.slug ?? '') === slug)
      const exact = matches.find((entry) => safeSegment(entry?.namespace?.handle, '') === guess)
      const chosen = exact ?? (matches.length === 1 ? matches[0] : undefined)
      return String(chosen?.namespace?.handle ?? '').trim()
    } catch {
      return ''
    }
  }

  let record
  try {
    record = await readInstallRecord()
  } catch {
    return { repaired, unresolved }
  }
  const entries = Object.entries(record)
    .filter(([directoryName, value]) => (
      String(value?.namespace ?? '').trim() === ''
      && String(directoryName).startsWith(`${LOCAL_HANDLE}--`) === false
      && String(directoryName).includes('--')
    ))
  if (entries.length === 0) return { repaired, unresolved }

  let changed = false
  for (const [directoryName, value] of entries) {
    const slug = String(directoryName).slice(String(directoryName).indexOf('--') + 2)
    const guess = String(directoryName).split('--')[0] ?? ''
    // Deduplicated, and the least surprising spelling first.
    const candidates = [...new Set([
      guess,
      guess.replace(/-/g, '_'),
      guess.replace(/-/g, ''),
      `${guess.replace(/-/g, '_')}`,
    ])].filter((candidate) => candidate !== '')

    let namespace = ''
    for (const candidate of candidates) {
      if (await namespacePublishes(candidate, slug)) { namespace = candidate; break }
    }
    if (namespace === '') namespace = await namespaceFromCatalogue(slug, guess)
    if (namespace === '') { unresolved.push(directoryName); continue }

    record[directoryName] = { ...value, namespace, slug }
    changed = true
    repaired.push(`${directoryName} -> ${namespace}`)
  }

  if (changed) {
    try {
      const path = installRecordPath()
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, `${JSON.stringify(record, null, 2)}\n`)
    } catch {
      /* a repair that cannot be written is not worth failing activation over */
    }
  }
  return { repaired, unresolved }
}


/**
 * Locate one installed skill by its directory name.
 *
 * The counterpart of {@link targetFor}, and deliberately the same shape: install and
 * uninstall must agree on where a skill is, or the two operations can act on different
 * directories. That is not hypothetical — a skill can exist in both roots if an older
 * build left a copy behind, and the pair then disagreed about which one was "the" skill.
 *
 * Neither root is privileged. Disabled state is the root a skill is in, so an uninstall
 * removes it from wherever it currently lives, and reports which that was.
 *
 * @param {string} directoryName - `<handle>--<slug>`.
 * @returns {{name: string, dir: string, enabled: boolean} | undefined} Location, or undefined when absent.
 * @throws {Error} When the name is not a usable directory name.
 */
function locateInstalled(directoryName) {
  // A directory the scan reported, which may have been named by the user rather than by us.
  const name = safeExistingDirectoryName(directoryName)
  const live = join(skillRoot(), name)
  const parked = join(disabledRoot(), name)
  const inLive = existsSync(live)
  const inParked = existsSync(parked)
  if (inLive) {
    return { name, dir: live, enabled: true, alsoParked: inParked }
  }
  if (inParked) return { name, dir: parked, enabled: false, alsoParked: false }
  return undefined
}

/**
 * Remove one installed skill from whichever root currently holds it.
 *
 * @param {{name: string}} request - Request carrying the skill's directory name.
 * @returns {Promise<{removed: string, from: string, wasDisabled: boolean}>} What was removed.
 * @throws {Error} When the name is unusable or no such skill is installed.
 */
async function uninstallSkill(request) {
  const located = locateInstalled(String(request.name ?? ''))
  if (located === undefined) throw new Error(`找不到技能目录：${safeExistingDirectoryName(request.name)}`)
  // Containment check on the resolved path, not on the request text.
  const root = located.enabled ? skillRoot() : disabledRoot()
  if (!resolve(located.dir).startsWith(resolve(root) + sep)) throw new Error('拒绝越界的卸载路径')
  await rm(located.dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 })
  // Drop the recorded release with the files, so a later install of the same directory
  // name cannot inherit the old version label.
  await forgetInstalledVersion(located.name)
  // A stale copy in the other root would otherwise be discovered by the next scan and look
  // like the skill came back. Only an old build can leave one, so this is cheap insurance.
  if (located.alsoParked === true) {
    await rm(join(disabledRoot(), located.name), { recursive: true, force: true, maxRetries: 3, retryDelay: 120 }).catch(() => {})
  }
  return { removed: located.name, from: located.dir, wasDisabled: located.enabled === false }
}

/* ── install: live registration ─────────────────────────────────────────── */

/**
 * Where a disabled skill's files are parked: `<plugin data>/skills`.
 *
 * Disabling moves the *directory* out of `$DSH_HOME/skills`, so the skill is
 * genuinely unreadable — not merely absent from this plugin's catalog. That
 * matters because `$DSH_HOME/skills` is the harness-wide root: if a profile has
 * the built-in filesystem provider mounted, anything left there is discovered by
 * someone else, and a panel switch that only withdraws one registration would
 * look implemented while still being listed. Moving the directory is also the
 * cheap operation on Windows, where replacing an in-use directory can fail.
 *
 * This directory is therefore the single source of truth for "disabled": a skill
 * present here is off, a skill in the skill root is on. It lives under
 * {@link pluginDataRoot} so everything this plugin owns is in one place, and it is
 * named {@link PARKED_DIRECTORY} — `skills` — because that is what it holds.
 *
 * @returns {string} Absolute directory.
 */
function disabledRoot() {
  return join(pluginDataRoot(), PARKED_DIRECTORY)
}

/**
 * Move one skill directory between the skill root and the disabled store.
 *
 * A rename when the two ends share a volume, which is the common case and the cheap
 * one. It is retried because a running Harness, an editor, or an indexer may briefly
 * hold a handle on a file inside the directory.
 *
 * Across volumes a rename is impossible (`EXDEV`) — and that is a real configuration,
 * not a corner case: the skill root is `$DSH_HOME/skills` while the disabled store
 * lives in the profile's plugin data directory, so a profile kept on a second drive hits this on
 * every toggle. The fallback copies the tree, verifies the copy, and only then removes
 * the original, so an interrupted move leaves the skill where it was rather than
 * losing it.
 *
 * @param {string} from - Source directory.
 * @param {string} to - Destination directory.
 * @param {boolean} [allowCopy] - Whether the cross-volume copy fallback may run.
 * @returns {Promise<void>} Resolves once the directory is in place.
 * @throws {Error} When the move cannot be completed.
 */
async function moveSkillDirectory(from, to, allowCopy = true) {
  if (from === to) return
  await mkdir(dirname(to), { recursive: true })
  let lastError
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      if (existsSync(to)) await rm(to, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 })
      await rename(from, to)
      return
    } catch (error) {
      lastError = error
      if (allowCopy && error?.code === 'EXDEV') {
        await copySkillDirectory(from, to)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }
  throw new Error(
    `无法移动技能目录（可能被其它程序占用，请关闭正在使用该目录的程序后重试）：${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

/**
 * Move one skill directory by copying it, for volumes a rename cannot span.
 *
 * The order matters and is the whole point: copy, confirm the destination holds the
 * same number of files, and only then delete the source. Deleting first would turn a
 * failed copy into a lost skill.
 *
 * @param {string} from - Source directory.
 * @param {string} to - Destination directory.
 * @returns {Promise<void>} Resolves once the copy is in place and the source is gone.
 * @throws {Error} When the copy cannot be completed or verified.
 */
async function copySkillDirectory(from, to) {
  await rm(to, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 }).catch(() => {})
  await mkdir(to, { recursive: true })
  await cp(from, to, { recursive: true, force: true, errorOnExist: false })
  const [expected, written] = await Promise.all([countFiles(from), countFiles(to)])
  if (expected !== written) {
    throw new Error(`跨卷移动校验失败：应复制 ${String(expected)} 个文件，实际 ${String(written)} 个`)
  }
  await rm(from, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 })
}

/**
 * Count the files in a directory tree.
 * @param {string} directory - Directory to walk.
 * @returns {Promise<number>} File count.
 */
async function countFiles(directory) {
  let total = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) total += await countFiles(join(directory, entry.name))
    else total += 1
  }
  return total
}

/**
 * Scan one root for skill directories with readable frontmatter.
 *
 * Every entry carries a fully typed shape because the registry validates each
 * field, and a malformed one aborts the whole catalog rather than skipping the
 * skill. `invocation` in particular is always a complete policy object.
 *
 * @param {string} root - Directory to scan.
 * @param {boolean} enabled - Whether the skills found here are enabled.
 * @returns {Promise<Array<object>>} Installed skills.
 */
async function scanRoot(root, enabled) {
  if (!existsSync(root)) return []
  /** @type {import('node:fs').Dirent[]} */
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    // An unreadable root is an empty skill set, never a thrown call.
    return []
  }
  const found = []
  for (const entry of entries) {
    if (entry.isDirectory() === false) continue
    const directory = join(root, entry.name)
    const instructionPath = join(directory, 'SKILL.md')
    try {
      const fields = parseFrontmatter(await readFile(instructionPath, 'utf8'))
      if (fields.name === undefined || fields.description === undefined) continue
      let files = 0
      let bytes = 0
      for (const file of await walkFiles(directory)) {
        files += 1
        bytes += file.size
      }
      found.push({
        directory,
        directoryName: entry.name,
        instructionPath,
        name: fields.name,
        description: fields.description,
        ...(fields.whenToUse === undefined ? {} : { whenToUse: fields.whenToUse }),
        invocation: fields.invocation,
        files,
        bytes,
        /**
         * When the skill's own directory was last written.
         *
         * The panel needs *some* real date for "安装于": its ledger lives in `localStorage` and
         * is empty on a fresh browser, so a skill installed before this page ever loaded had no
         * timestamp at all — which the UI then rendered as 1970, i.e. "57 年前". The directory's
         * mtime is the honest answer available to the Host, and the install record's own `at`
         * is preferred over it where one exists.
         */
        modifiedAt: await stat(instructionPath).then((info) => info.mtimeMs).catch(() => 0),
        enabled,
      })
    } catch {
      // A skill whose instruction file is unreadable is skipped, not fatal.
    }
  }
  return found
}

/**
 * Scan both roots: enabled skills first, then the disabled store.
 * @returns {Promise<Array<object>>} Every installed skill with its state.
 */
async function scanInstalled() {
  const enabledSkills = await scanRoot(skillRoot(), true)
  const disabledSkills = await scanRoot(disabledRoot(), false)
  return [...enabledSkills, ...disabledSkills]
}

/**
 * Walk a directory tree and return its files with sizes.
 * @param {string} directory - Directory to walk.
 * @returns {Promise<Array<{path: string, size: number}>>} Files.
 */
async function walkFiles(directory) {
  const out = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) out.push(...await walkFiles(path))
    else out.push({ path, size: (await stat(path)).size })
  }
  return out
}

/**
 * Owns the live `ctx.skills` registrations for installed skills.
 *
 * The registration is the state: `register` publishes a skill to the running
 * session, the returned disposer withdraws it, and the enabled set is whatever is
 * currently registered. The persisted `disabled` list is only how a choice
 * survives a process start.
 */
class InstalledSkillRegistry {
  /**
   * @param {object} ctx - Host plugin context.
   */
  constructor(ctx) {
    this.ctx = ctx
    /** @type {Map<string, {name: string, dispose: () => void, summary: object}>} */
    this.live = new Map()
  }

  /**
   * Publish every skill that is currently in the skill root.
   *
   * Which skills are on is not read from a state file: it is where the
   * directories are. A skill in the skill root is on, a skill in the disabled
   * store is off, so the two can never disagree.
   *
   * @returns {Promise<object>} A summary of what is registered.
   */
  async start() {
    return this.sync()
  }

  /**
   * Bring the live registrations in line with the disk.
   *
   * Idempotent: a skill already registered under the same name is left alone, so
   * calling this after every install, uninstall or toggle is cheap and safe.
   *
   * @returns {Promise<object>} The resulting summary.
   */
  async sync() {
    const installed = await scanInstalled()
    const wanted = new Set()

    for (const skill of installed) {
      if (!skill.enabled) continue
      wanted.add(skill.directory)
      const existing = this.live.get(skill.directory)
      if (existing?.name === skill.name) continue
      if (existing !== undefined) this.unregister(skill.directory)
      this.register(skill)
    }

    // Drop registrations whose directory vanished or moved to the disabled store.
    for (const [directory, entry] of [...this.live]) {
      if (wanted.has(directory)) continue
      this.unregister(directory)
    }

    return this.summary(installed)
  }

  /**
   * Publish one skill to the registry.
   * @param {object} skill - Entry from {@link scanInstalled}.
   * @returns {void}
   */
  register(skill) {
    const definition = {
      name: skill.name,
      description: skill.description,
      ...(skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse }),
      // `register()` defaults `invocation` and `provider` but NOT `source`, and
      // `validateDefinition` rejects a missing one — so it is passed explicitly.
      source: 'skill-market',
      invocation: skill.invocation,
      path: skill.instructionPath,
      resourceBase: { kind: 'directory', path: skill.directory },
      // Read synchronously here: `register()` is synchronous and the body is
      // small (a few KB), so the definition is complete from the start.
      content: '',
    }
    try {
      definition.content = readFileSync(skill.instructionPath, 'utf8')
    } catch {
      return
    }
    const dispose = this.ctx.skills.register({ ...definition, provider: 'skill-market' })
    this.live.set(skill.directory, { name: skill.name, dispose, summary: definition })
    this.ctx.logger?.debug?.(`skill-market: registered "${skill.name}"`)
  }

  /**
   * Withdraw one skill's registration.
   * @param {string} directory - Skill directory key.
   * @returns {void}
   */
  unregister(directory) {
    const entry = this.live.get(directory)
    if (entry === undefined) return
    this.live.delete(directory)
    try {
      entry.dispose()
    } catch (error) {
      this.ctx.logger?.warn?.(`skill-market: failed to withdraw "${entry.name}": ${String(error)}`)
    }
  }

  /**
   * Turn one installed skill on or off.
   *
   * Disabling *moves the directory out of the skill root* and enabling moves it
   * back, so the state is the filesystem: the harness and any other provider see
   * the skill appear and disappear, and the live registration follows. The
   * registration is withdrawn before the move so nothing can read a file that is
   * about to relocate, and re-established by the `sync()` that follows.
   *
   * @param {string} directory - Directory name inside the skill root, or inside the disabled store.
   * @param {boolean} enabled - Desired state.
   * @returns {Promise<object>} The resulting summary.
   * @throws {Error} When the directory cannot be moved.
   */
  async setEnabled(directory, enabled) {
    // The client sends the directory name it was shown, which for a hand-placed skill is whatever
    // the user called the folder. Only path safety is enforced here; the naming convention is not.
    const name = safeExistingDirectoryName(directory)
    const live = join(skillRoot(), name)
    const parked = join(disabledRoot(), name)
    const from = enabled ? parked : live
    const to = enabled ? live : parked
    if (!existsSync(from)) {
      // Already in the requested state (or gone): reconcile and report.
      if (!existsSync(to)) throw new Error(`找不到技能目录：${name}`)
      return this.sync()
    }
    this.unregister(from)
    await moveSkillDirectory(from, to)
    this.ctx.logger?.debug?.(`skill-market: ${enabled ? 'enabled' : 'disabled'} "${name}"`)
    return this.sync()
  }

  /**
   * Report the catalog as the panel shows it, with each skill's latest release.
   *
   * `latestVersion` is what lets every list — 发现 / 已安装 / 收藏 — offer an update
   * without asking the user to open each skill: the panel cannot compare versions it does
   * not have, and the list endpoint's `version` is the *skill's current* release, not a
   * per-install fact. It costs one upstream detail request per skill, served from the
   * shared cache on repeat loads and capped by {@link latestVersions}.
   *
   * @param {Array<object>} [installed] - Pre-computed scan, to avoid scanning twice.
   * @returns {Promise<object>} Summary with `root`, `disabledRoot`, `skills` and `disabled`.
   */
  async summary(installed) {
    const skills = installed ?? await scanInstalled()
    // A locally imported skill has no upstream record, so it must not be looked up: the version
    // hash-match would ask SkillHub about a publisher called `local`, and the latest-version
    // query would do the same. `origin` is what tells the two apart.
    const local = skills.filter((skill) => String(skill.directoryName ?? '').startsWith(`${LOCAL_HANDLE}--`))
    const fromMarket = skills.filter((skill) => String(skill.directoryName ?? '').startsWith(`${LOCAL_HANDLE}--`) === false)
    const [versions, record] = await Promise.all([latestVersions(fromMarket), readInstallRecord()])
    const resolved = new Map()
    for (const skill of local) {
      resolved.set(String(skill.directoryName), { version: declaredVersionOf(skill), source: 'frontmatter' })
    }
    await Promise.all(fromMarket.map(async (skill) => {
      const directoryName = String(skill.directoryName ?? '')
      // Cheapest and most authoritative first: what this plugin recorded writing. Then,
      // when there is no record (an install from an earlier build, or a hand-copied
      // directory), ask which release's manifest the bytes on disk match — because the
      // package's own `version:` field cannot be trusted to describe its own files.
      const recorded = record[directoryName]?.version
      if (typeof recorded === 'string' && recorded !== '') {
        resolved.set(directoryName, { version: recorded, source: 'record' })
        return
      }
      const matched = directoryName.includes('--') ? await versionMatchingDisk(directoryName) : undefined
      resolved.set(directoryName, matched === undefined
        ? { version: declaredVersionOf(skill), source: 'frontmatter' }
        : { version: matched, source: 'files' })
    }))
    return {
      root: skillRoot(),
      disabledRoot: disabledRoot(),
      skills: skills.map((skill) => ({
        directory: skill.directory,
        directoryName: skill.directoryName,
        /**
         * The upstream namespace and slug a detail lookup needs.
         *
         * Read from the install record first, because the directory name is a **lossy** encoding of the
         * identity: a namespace containing an underscore (`user_814dbe54`) is written to disk as
         * `user-814dbe54`, and asking upstream for that namespace answers 404 — which is how the drawer
         * came to never load for any skill under such a namespace.
         *
         * Falls back to the directory name when there is no record: a hand-placed directory, or an
         * install from a build that predates the record carrying identity.
         */
        handle: String(record[String(skill.directoryName)]?.namespace ?? '').trim()
          || (String(skill.directoryName ?? '').split('--')[0] ?? ''),
        slug: String(record[String(skill.directoryName)]?.slug ?? '').trim()
          || (String(skill.directoryName ?? '').includes('--')
            ? String(skill.directoryName).slice(String(skill.directoryName).indexOf('--') + 2)
            : ''),
        /**
         * Where this skill came from, which decides where the panel lists it.
         *
         *   `local`  — imported through the panel; the directory is `local--<name>`
         *   `market` — this plugin downloaded it; the install record has it
         *   `manual` — the user placed the directory here themselves
         *
         * The install record is what separates the last two: a directory written by an install is
         * recorded, and anything else was put there by hand. Inferring from the name alone would
         * file every hand-copied skill under `market`, which is why they were invisible on the
         * 本地导入 page.
         */
        origin: String(skill.directoryName ?? '').startsWith(`${LOCAL_HANDLE}--`)
          ? 'local'
          : (record[String(skill.directoryName)] === undefined ? 'manual' : 'market'),
        name: skill.name,
        registeredAs: skill.name,
        description: skill.description,
        version: resolved.get(String(skill.directoryName))?.version ?? '',
        /** Where that version came from, so the UI can be honest about a guess. */
        versionSource: resolved.get(String(skill.directoryName))?.source ?? 'unknown',
        latestVersion: versions.get(skill.directoryName) ?? '',
        /**
         * When this skill was installed, as best the Host can tell.
         *
         * The recorded install time when there is one, otherwise the directory's own mtime.
         * Never `0`: that number means 1970 to a formatter, which is how the panel came to
         * claim a skill had been installed 57 years ago.
         */
        installedAt: Number(record[String(skill.directoryName)]?.at ?? 0) || Number(skill.modifiedAt ?? 0) || 0,
        files: skill.files,
        bytes: skill.bytes,
        enabled: skill.enabled,
        registered: this.live.has(skill.directory),
      })),
      disabled: skills.filter((skill) => !skill.enabled).map((skill) => skill.directory),
    }
  }
}

/**
 * Read the version an installed skill's own `SKILL.md` declares.
 *
 * **This is a hint, not the installed release.** Measured on a real install: installing
 * `dev-expert` 2.0.2 wrote files whose hashes match 2.0.2 exactly, while that package's own
 * `SKILL.md` still declared `version: "2.0.3"` — upstream does not reliably bump the field
 * it publishes. So this can only be used where nothing better exists, and never to decide
 * whether an update is available: the recorded install version and the upstream listing
 * both outrank it.
 *
 * @param {object} skill - Scan entry carrying `instructionPath`.
 * @returns {string} Declared version, or '' when absent.
 */
function declaredVersionOf(skill) {
  try {
    const instruction = readFileSync(skill.instructionPath, 'utf8')
    // The frontmatter block only: a `version:` line in the body is prose, not metadata.
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(instruction)
    if (frontmatter === null) return ''
    const match = /^version:\s*(.+)$/m.exec(frontmatter[1])
    return match === null ? '' : match[1].trim().replace(/^["']|["']$/g, '')
  } catch {
    return ''
  }
}

/**
 * Where this plugin records which release it wrote for each skill.
 *
 * The record exists because nothing on disk answers the question: the package's own
 * `SKILL.md` may declare a version its files do not match, and the files themselves carry
 * no version at all. Only the install knows what it asked for, so it writes it down.
 *
 * @returns {string} Absolute file path.
 */
function installRecordPath() {
  return join(pluginDataRoot(), 'installed.json')
}

/**
 * Read the recorded install versions.
 * @returns {Promise<Record<string, {version: string, at: number}>>} Record keyed by directory name.
 */
async function readInstallRecord() {
  try {
    const parsed = JSON.parse(await readFile(installRecordPath(), 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Persist one skill's installed release, and the upstream identity it came from.
 *
 * The identity is recorded because the directory name is a **lossy** encoding of it. `safeSegment`
 * rewrites anything outside `[a-z0-9]` to `-`, and namespaces routinely contain underscores, so
 * `user_814dbe54` becomes the directory `user-814dbe54`. Every detail request then asked upstream for a
 * namespace that does not exist and got a 404 — the drawer simply never loaded for those skills.
 *
 * The slug survives intact (it is already kebab-case), so only the namespace is truly lost; both are
 * recorded anyway, so the next lossy rule does not cause the same fault again.
 *
 * Failure is never fatal: the record sharpens a version label and an identity lookup, and a missing
 * record degrades to the directory-derived guess.
 *
 * @param {string} directoryName - `<handle>--<slug>` as written to disk.
 * @param {string} version - The release that was written.
 * @param {{namespace?: string, slug?: string}} [identity] - Upstream namespace and slug.
 * @returns {Promise<void>} Resolves once written, or after any failure.
 */
async function recordInstalledVersion(directoryName, version, identity = {}) {
  if (directoryName === '' || version === '') return
  try {
    const record = await readInstallRecord()
    const existing = record[directoryName] ?? {}
    const namespace = String(identity.namespace ?? existing.namespace ?? '').trim()
    const slug = String(identity.slug ?? existing.slug ?? '').trim()
    record[directoryName] = {
      version,
      at: Date.now(),
      // Carried forward when the caller does not restate them, so a version bump cannot erase the
      // identity that a repair pass recovered.
      ...(namespace === '' ? {} : { namespace }),
      ...(slug === '' ? {} : { slug }),
    }
    const path = installRecordPath()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`)
  } catch {
    /* a version label is not worth failing an install over */
  }
}

/**
 * Drop one skill's recorded release.
 * @param {string} directoryName - `<handle>--<slug>`.
 * @returns {Promise<void>} Resolves once written, or after any failure.
 */
async function forgetInstalledVersion(directoryName) {
  try {
    const record = await readInstallRecord()
    if (record[directoryName] === undefined) return
    delete record[directoryName]
    const path = installRecordPath()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`)
  } catch {
    /* a stale label is corrected by the next install */
  }
}

/**
 * Determine which upstream release an installed skill's files match.
 *
 * The hash comparison is the ground truth: it asks upstream for a release's manifest and
 * checks the bytes on disk against it. That is what caught the case this exists for — a
 * directory whose `SKILL.md` claimed 2.0.3 while all 84 files matched 2.0.2.
 *
 * Only the newest few releases are tried, because a skill installed long ago is rarely the
 * question; `undefined` means "no candidate matched", which the panel reports as unknown
 * rather than guessing.
 *
 * @param {string} directoryName - `<handle>--<slug>`.
 * @param {number} [candidates] - How many recent releases to compare against.
 * @returns {Promise<string | undefined>} The matching version, or undefined.
 */
async function versionMatchingDisk(directoryName, candidates = 4) {
  const [handle, ...rest] = directoryName.split('--')
  const slug = rest.join('--')
  if (handle === '' || slug === '') return undefined
  let versions = []
  try {
    const params = new URLSearchParams({ namespace: handle })
    const { entry } = await fetchUpstream(`${UPSTREAM}/api/v1/skills/${encodeURIComponent(slug)}/versions?${params.toString()}`)
    const parsed = JSON.parse(entry.body)
    versions = (Array.isArray(parsed?.versions) ? parsed.versions : []).slice(0, candidates)
  } catch {
    return undefined
  }
  const directory = join(skillRoot(), directoryName)
  for (const record of versions) {
    const version = String(record?.version ?? '')
    if (version === '') continue
    try {
      const params = new URLSearchParams({ namespace: handle, version })
      const { entry } = await fetchUpstream(`${UPSTREAM}/api/v1/skills/${encodeURIComponent(slug)}/files?${params.toString()}`)
      const listing = JSON.parse(entry.body)
      const files = Array.isArray(listing?.files) ? listing.files : []
      if (files.length === 0) continue
      const identical = files.every((file) => {
        const path = join(directory, ...String(file?.path ?? '').split('/'))
        try {
          return createHash('sha256').update(readFileSync(path)).digest('hex') === String(file.sha256 ?? '')
        } catch {
          return false
        }
      })
      if (identical) return version
    } catch {
      // Try the next candidate.
    }
  }
  return undefined
}

/** How many installed skills get a latest-version lookup per summary. */
const MAX_VERSION_LOOKUPS = 40

/**
 * Look up the latest published version for each installed skill.
 *
 * Bounded and failure-tolerant by design: this is decoration for an update affordance, so
 * one unreachable skill must not empty the library list. Requests go through
 * {@link fetchUpstream}, which caches for five minutes, so a panel reload is free.
 *
 * @param {Array<object>} skills - Scan entries with `directoryName`.
 * @returns {Promise<Map<string, string>>} Latest version keyed by directory name.
 */
async function latestVersions(skills) {
  const wanted = skills
    .map((skill) => String(skill.directoryName ?? ''))
    .filter((directoryName) => directoryName.includes('--'))
    .slice(0, MAX_VERSION_LOOKUPS)
  const out = new Map()
  await Promise.all(wanted.map(async (directoryName) => {
    const [handle, ...rest] = directoryName.split('--')
    const slug = rest.join('--')
    if (handle === '' || slug === '') return
    const params = new URLSearchParams({ namespace: handle })
    const target = `${UPSTREAM}/api/v1/skills/${encodeURIComponent(slug)}?${params.toString()}`
    try {
      const { entry } = await fetchUpstream(target)
      const body = JSON.parse(entry.body)
      const latest = String(body?.latestVersion?.version ?? '')
      if (latest !== '') out.set(directoryName, latest)
    } catch {
      // No latest version means no update affordance for that row; never fatal.
    }
  }))
  return out
}

/* ── routing ────────────────────────────────────────────────────────────── */

/**
 * Read the entries of a ZIP archive from a buffer.
 *
 * Written against the format rather than shelling out to `tar` or `Expand-Archive`: those
 * exist on this machine but not necessarily on a user's, and a feature that silently depends
 * on an external binary is a feature that fails somewhere else. Only what a skill package
 * needs is implemented — stored and deflated entries, no encryption, no multi-disk, no ZIP64 —
 * and everything else is refused with a reason.
 *
 * @param {Buffer} buffer - Whole archive.
 * @returns {Array<{name: string, method: number, offset: number, compressedSize: number, size: number}>} Entries.
 * @throws {Error} When the buffer is not a readable ZIP.
 */
function readZipEntries(buffer) {
  // End of central directory: signature, then a trailing comment of variable length, so it is
  // searched for from the end rather than assumed to be the last 22 bytes.
  const eocdSignature = 0x06054b50
  let eocd = -1
  for (let at = buffer.length - 22; at >= 0 && at >= buffer.length - 22 - 0xffff; at -= 1) {
    if (buffer.readUInt32LE(at) === eocdSignature) { eocd = at; break }
  }
  if (eocd < 0) throw new Error('不是有效的 zip 压缩包')
  const count = buffer.readUInt16LE(eocd + 10)
  const directoryOffset = buffer.readUInt32LE(eocd + 16)
  if (count === 0) throw new Error('zip 压缩包里没有文件')

  const entries = []
  let cursor = directoryOffset
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('zip 中央目录已损坏')
    }
    const method = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const size = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    // A local header repeats the name and extra fields, so the data starts after them.
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`zip 局部文件头已损坏：${name}`)
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    entries.push({
      name,
      method,
      size,
      compressedSize,
      offset: localOffset + 30 + localNameLength + localExtraLength,
    })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/**
 * Decompress one ZIP entry to bytes.
 * @param {Buffer} buffer - Whole archive.
 * @param {{name: string, method: number, offset: number, compressedSize: number, size: number}} entry - Entry.
 * @returns {Buffer} File contents.
 * @throws {Error} When the entry uses an unsupported compression method.
 */
function readZipEntry(buffer, entry) {
  const raw = buffer.subarray(entry.offset, entry.offset + entry.compressedSize)
  if (entry.method === 0) return Buffer.from(raw)
  if (entry.method === 8) return inflateRawSync(raw)
  throw new Error(`不支持的压缩方式（${entry.method}）：${entry.name}`)
}

/**
 * Reject an archive path that must not become a write destination.
 *
 * Same rule as an upstream file path: the archive is attacker-controlled input, so containment
 * is checked on the resolved path rather than on the text.
 *
 * @param {string} name - Entry name from the archive.
 * @returns {string | undefined} The safe relative path, or undefined when it must be skipped.
 */
function safeArchivePath(name) {
  const normalized = String(name).replace(/\\/g, '/')
  if (normalized.endsWith('/')) return undefined
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return undefined
  const parts = normalized.split('/').filter((part) => part !== '' && part !== '.')
  if (parts.length === 0 || parts.includes('..')) return undefined
  // macOS metadata appears at this level *inside* a wrapper directory too
  // (`pkg/__MACOSX/...`), so it is matched at any depth rather than only at the root. Checking
  // just the first segment let a `__MACOSX` folder inside the package land in the skill
  // directory — measured, not hypothetical.
  if (parts.some((part) => part === '__MACOSX' || part.startsWith('._'))) return undefined
  return parts.join('/')
}

/**
 * Import a local skill package into the shared skill root.
 *
 * Accepts a `.zip`/`.skill` archive or a bare `SKILL.md`. The archive is unpacked into the
 * same root the market installs into, under `local--<name>`, so a locally imported skill is an
 * ordinary local skill: the harness discovers it, `ctx.skills` publishes it, and it is callable
 * from any conversation. Nothing about it is stored in the panel's own ledger — the directory
 * is the record, exactly as it is for an installed skill.
 *
 * @param {{name: string, bytes: Buffer}} request - Original filename and the uploaded bytes.
 * @returns {Promise<object>} Import result for the client.
 * @throws {Error} When the package is unreadable or is not a valid skill.
 */
async function importLocalSkill(request) {
  const fileName = safeSegment(request?.name, 'skill')
  const bytes = request?.bytes
  if (Buffer.isBuffer(bytes) === false || bytes.byteLength === 0) throw new Error('没有收到文件内容')
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new Error(`技能包过大（${Math.round(bytes.byteLength / 1024 / 1024)} MB > ${MAX_IMPORT_BYTES / 1024 / 1024} MB）`)
  }

  // Bare Markdown is a skill in its own right: one file, no archive.
  const looksLikeZip = bytes.length > 4 && bytes.readUInt32LE(0) === 0x04034b50
  const fromMarkdown = looksLikeZip === false && (fileName.endsWith('.md') || bytes.subarray(0, 3).toString('utf8') === '---')
  if (looksLikeZip === false && fromMarkdown === false) {
    throw new Error('无法识别的技能包：请提供 .skill、.zip 压缩包，或一个 SKILL.md')
  }

  /** `{path, bytes}` pairs in the order they will be written. */
  let files
  if (fromMarkdown) {
    files = [{ path: 'SKILL.md', bytes }]
  } else {
    const entries = readZipEntries(bytes)
    if (entries.length > MAX_FILES) throw new Error(`文件数超出上限（${entries.length} > ${MAX_FILES}）`)
    files = []
    let total = 0
    for (const entry of entries) {
      const path = safeArchivePath(entry.name)
      if (path === undefined) continue
      const content = readZipEntry(bytes, entry)
      if (content.byteLength > MAX_FILE_BYTES) throw new Error(`文件过大（${Math.round(content.byteLength / 1024)} KB）：${path}`)
      total += content.byteLength
      if (total > MAX_TOTAL_BYTES) throw new Error('技能包解压后体积超出上限')
      files.push({ path, bytes: content })
    }
    // Archives made by "compress this folder" add one wrapper level. Drop it when every entry
    // shares it, so `pkg/SKILL.md` and `SKILL.md` behave the same.
    const roots = new Set(files.map((file) => file.path.split('/')[0]))
    if (files.some((file) => file.path.includes('/')) && roots.size === 1) {
      const prefix = `${[...roots][0]}/`
      files = files.map((file) => ({ ...file, path: file.path.slice(prefix.length) }))
    }
  }

  const instruction = files.find((file) => file.path.toLowerCase() === 'skill.md')
  if (instruction === undefined) throw new Error('技能包缺少 SKILL.md，无法被 Harness 识别为技能')
  const frontmatter = parseFrontmatter(instruction.bytes.toString('utf8'))
  if (frontmatter.name === undefined || frontmatter.description === undefined) {
    throw new Error('该技能的 SKILL.md 缺少 name 或 description，无法被 Harness 识别')
  }
  // Same grammar the registry applies on load, via the shared constant rather than a second
  // hand-written pattern: an import that passes here and fails there would import silently and then
  // never appear, which reads as a broken import rather than a bad package.
  assertSkillName(frontmatter.name)

  const name = `${LOCAL_HANDLE}--${frontmatter.name}`.slice(0, 128)
  const dir = join(skillRoot(), name)
  const staging = `${dir}.installing`
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  try {
    let written = 0
    for (const file of files) {
      const destination = resolveInside(staging, file.path)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, file.bytes)
      written += 1
    }
    await swapIntoPlace(staging, dir)
    await ensureStateTree()
    return {
      name: frontmatter.name,
      directory: dir,
      directoryName: name,
      files: written,
      bytes: files.reduce((sum, file) => sum + file.bytes.byteLength, 0),
      version: declaredVersionOf({ instructionPath: join(dir, 'SKILL.md') }),
      enabled: true,
    }
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

/**
 * Read a request body as raw bytes, with a size ceiling.
 *
 * The ceiling is enforced while reading, not after: a body that is too large must be refused
 * before it is buffered, or the limit only measures the damage after it is done.
 *
 * @param {import('node:http').IncomingMessage} req - Incoming request.
 * @param {number} limit - Largest accepted body, in bytes.
 * @returns {Promise<Buffer>} The body.
 * @throws {Error} When the body is empty or too large.
 */
async function readBinaryBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error(`请求体过大（上限 ${Math.round(limit / 1024 / 1024)} MB）`)
    chunks.push(chunk)
  }
  if (chunks.length === 0) throw new Error('请求体为空')
  return Buffer.concat(chunks)
}

/**
 * Read and JSON-parse a request body with a size ceiling.
 *
 * The ceiling is a parameter because the bodies this route receives differ by two orders of
 * magnitude: an install request is a few hundred bytes, while the panel's own state document
 * carries every favorite's full record.
 *
 * @param {import('node:http').IncomingMessage} req - Incoming request.
 * @param {number} [limit] - Largest accepted body, in bytes.
 * @returns {Promise<object>} The parsed body, or an empty object.
 * @throws {Error} When the body is too large or not JSON.
 */
async function readJsonBody(req, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw badRequest('请求体过大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Categories the panel does not offer, so it does not count them either.
 *
 * `pay-skill` is upstream's commercial tier rather than a topic. The vocabulary
 * endpoint's `active` flag does not exclude it, so the panel filters it by key — and
 * this counter has to agree, or the response would carry a count for a chip that is
 * never rendered. Kept in sync with the client's `HIDDEN_CATEGORIES`.
 */
const HIDDEN_CATEGORIES = new Set(['pay-skill'])

/**
 * Count the skills in every active top-level category.
 *
 * The category vocabulary endpoint returns no counts, and the list endpoint's per
 * category total is the only place that number exists. So this asks once per
 * category with `pageSize=1` — the smallest request that still reports the total —
 * and does it here rather than in the browser, because the browser cannot call the
 * upstream at all (no CORS header) and because one cached answer serves every tab.
 *
 * Answers are cached by {@link fetchUpstream}, so a panel reload is free.
 *
 * @returns {Promise<Record<string, number>>} Counts keyed by category, empty on total failure.
 */
async function categoryCounts() {
  const listing = await fetchUpstream(`${UPSTREAM}/api/v1/categories`)
  let items = []
  try {
    const parsed = JSON.parse(listing.entry.body)
    items = Array.isArray(parsed?.items) ? parsed.items : []
  } catch {
    return {}
  }
  const keys = items
    .filter((item) => item?.active !== false && Number(item?.level ?? 1) === 1)
    .map((item) => String(item?.key ?? ''))
    .filter((key) => key !== '' && HIDDEN_CATEGORIES.has(key) === false)

  const counts = {}
  await Promise.all(keys.map(async (key) => {
    try {
      const url = `${UPSTREAM}/api/skills?page=1&pageSize=1&sortBy=score&category=${encodeURIComponent(key)}`
      const { entry } = await fetchUpstream(url)
      const body = JSON.parse(entry.body)
      const total = Number(body?.data?.total)
      if (Number.isFinite(total)) counts[key] = total
    } catch {
      // One unreachable category just has no count; the chip still renders.
    }
  }))
  return counts
}

/**
 * Build one skill's upstream sub-resource URL from the query the panel sends.
 *
 * The panel passes `slug` and `namespace`, so the values are validated before they are
 * pasted into a path: a slug or handle carrying `/`, `..` or a scheme could otherwise
 * retarget the proxy at a different upstream endpoint entirely. Anything unacceptable
 * throws, and `handle` answers 400 through the caller's catch.
 *
 * @param {URL} url - Incoming request URL carrying `slug` and `namespace`.
 * @param {string} resource - `''`, `'/versions'` or `'/files'`.
 * @returns {string} Absolute upstream URL.
 * @throws {Error} When a required parameter is missing or malformed.
 */
function skillSubresourceUrl(url, resource) {
  const slug = safeUpstreamName(url.searchParams.get('slug'), 'slug')
  const namespace = safeUpstreamName(url.searchParams.get('namespace'), 'namespace')
  return `${UPSTREAM}/api/v1/skills/${encodeURIComponent(slug)}${resource}?namespace=${encodeURIComponent(namespace)}`
}

/**
 * Mark an error as the caller's fault, so the route answers 400 rather than 502.
 * @param {string} message - Operator-facing reason.
 * @returns {Error} Tagged error.
 */
function badRequest(message) {
  const error = new Error(message)
  error.badRequest = true
  return error
}

/**
 * Reduce upstream's `securityReports` to one verdict, plus the reports behind it.
 *
 * Upstream scans each skill with several vendors (observed: `keen`, `sanbu`) and reports them
 * independently, so the vendors can disagree — `ima-skills` is `benign` from one and `suspicious`
 * from the other. A single "safe" badge over that would be a claim nobody made, so:
 *
 *   `safe`     every vendor says benign, and there is at least one vendor
 *   `risk`     any vendor says suspicious
 *   `pending`  no risk, but at least one vendor is still queued
 *   `unknown`  upstream said nothing either way
 *
 * Only `safe` may render as 「安全」. `risk` is deliberately not surfaced as a badge of its own —
 * the panel states what it was told rather than editorialising about a scan it cannot interpret —
 * but it must never be collapsed into `safe`.
 *
 * @param {unknown} reports - Raw `securityReports` from the detail response.
 * @returns {{verdict: string, vendors: Array<{vendor: string, status: string, statusText: string, reportUrl: string}>}}
 *   Normalised verdict and the per-vendor reports it came from.
 */
function safetyVerdict(reports) {
  const vendors = []
  if (reports !== null && typeof reports === 'object') {
    for (const [vendor, report] of Object.entries(reports)) {
      if (report === null || typeof report !== 'object') continue
      vendors.push({
        vendor,
        status: String(report.status ?? ''),
        statusText: String(report.statusText ?? ''),
        reportUrl: typeof report.reportUrl === 'string' ? report.reportUrl : '',
      })
    }
  }
  const statuses = vendors.map((vendor) => vendor.status)
  let verdict = 'unknown'
  if (vendors.length > 0) {
    if (statuses.includes('suspicious')) verdict = 'risk'
    else if (statuses.every((status) => status === 'benign')) verdict = 'safe'
    else if (statuses.includes('queued')) verdict = 'pending'
  }
  return { verdict, vendors }
}

/**
 * Serve one file's text out of a skill bundle.
 *
 * The detail drawer shows the skill's own `SKILL.md` — the same instructions the harness
 * loads — so this proxies a single file rather than making the browser fetch from COS
 * (which CORS forbids anyway). The response is text; anything that is not decodable text
 * is refused rather than served as mojibake.
 *
 * @param {import('node:http').ServerResponse} res - Response to own.
 * @param {URL} url - Request URL carrying `slug`, `namespace` and `path`.
 * @returns {Promise<void>} Resolves once answered.
 */
async function handleSkillFile(res, url) {
  try {
    const slug = safeUpstreamName(url.searchParams.get('slug'), 'slug')
    const namespace = safeUpstreamName(url.searchParams.get('namespace'), 'namespace')
    const filePath = String(url.searchParams.get('path') ?? '').trim()
    if (filePath === '') throw badRequest('缺少 path')
    // Reuses the installer's path validator: the same rejections (absolute, drive,
    // backslash, NUL, `..`, escape after normalisation) matter for a read as for a write.
    resolveInside(process.cwd(), filePath)
    if (filePath.length > MAX_PREVIEW_PATH) throw badRequest('path 过长')
    // Optional: preview one release's copy of a file, as the version list offers.
    const version = String(url.searchParams.get('version') ?? '').trim()
    if (version !== '' && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version)) throw badRequest('version 含非法字符')
    const bytes = await fetchFile(slug, namespace, filePath, undefined, version)
    if (bytes.byteLength > MAX_PREVIEW_BYTES) {
      sendJson(res, 200, { path: filePath, truncated: true, bytes: bytes.byteLength, text: '' })
      return
    }
    sendJson(res, 200, { path: filePath, truncated: false, bytes: bytes.byteLength, text: bytes.toString('utf8') })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    sendError(res, error?.badRequest === true ? 400 : 502, `技能文件请求失败：${reason}`)
  }
}

/**
 * Validate one upstream path segment (a slug or a publisher handle).
 * @param {unknown} value - Raw query value.
 * @param {string} label - Parameter name for the error message.
 * @returns {string} The validated value.
 * @throws {Error} Tagged as a bad request when missing or malformed.
 */
function safeUpstreamName(value, label) {
  const text = String(value ?? '').trim()
  if (text === '') throw badRequest(`缺少 ${label}`)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(text)) throw badRequest(`${label} 含非法字符`)
  return text
}

/* ── panel state: the browser half's own document ───────────────────────── */

/**
 * Where the panel's own state is kept: one JSON document in this plugin's data directory.
 *
 * `$DSH_HOME/storages/@montersy123/dsh-skill-market/data/panel.json`, beside the disabled store and the
 * install record. It holds the favorites (ids plus their records), the installed ledger, the
 * category preference, and the restart advice.
 *
 * The panel used to keep this in the page's `localStorage`. That store is **not this plugin's**:
 * on the desktop it is one LevelDB under `%APPDATA%\@deepseek-ai\dsh-desktop\Local Storage`,
 * shared with DSH's own keys and with every other plugin, keyed by origin rather than by plugin
 * — so a plugin's data sits in DSH's data, an uninstall leaves it behind, and nothing tells the
 * user where their favorites went. The data directory this plugin already owns has none of those
 * properties: it is per profile, it survives a package replacement, and it can be read, backed up
 * or deleted by the person it belongs to.
 *
 * @returns {string} Absolute file path.
 */
function panelStateFile() {
  return join(pluginDataRoot(), 'panel.json')
}

/**
 * Largest accepted panel document, in bytes.
 *
 * Generous for the shape it holds — a favorite carries its full catalogue record, so a few
 * thousand of them would still fit — and small enough that a malformed client cannot make the
 * Host buffer an unbounded body.
 */
const MAX_PANEL_STATE_BYTES = 4 * 1024 * 1024

/**
 * When the Host process started, in epoch milliseconds.
 *
 * The panel's restart advice is about *this* process: a skill changed here is live for new
 * conversations immediately, but an already open conversation keeps the catalog its agent was
 * created with until the Harness restarts. So the advice is retired by exactly one event — the
 * Host starting again — and this is how the panel recognises it. Reported with every state
 * response rather than derived from a file, because it is a fact about the running process.
 *
 * @type {number}
 */
const HOST_STARTED_AT = Date.now() - Math.round(process.uptime() * 1000)

/** Serialises writes, so two overlapping requests cannot interleave their temp-file renames. */
let panelWriteChain = Promise.resolve()

/**
 * Read the stored document.
 *
 * Absent and unreadable are both reported as `null`, which is the honest answer for this
 * document: the panel starts from its defaults and the next change writes a complete one. A
 * truncated file from a power loss therefore costs at most the last change, never a crash.
 *
 * @returns {Promise<object | null>} The document, or null when there is none to read.
 */
async function readPanelState() {
  try {
    const parsed = JSON.parse(await readFile(panelStateFile(), 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Rename a file into place, retrying the transient failures Windows produces.
 *
 * Replacing a file that anything else has open fails with `EPERM`/`EACCES`/`EBUSY` for as long as
 * the other handle lives: a virus scanner, a backup agent, or an indexer that has just noticed the
 * file. It is the same class of failure the disabled-store move retries, and it was measured the
 * same way — the panel's own write was seen failing with `EPERM: operation not permitted, rename`,
 * which left the stored document one change behind. A handful of short waits is the whole fix; the
 * failure itself is a moment, not a condition.
 *
 * @param {string} from - Source path.
 * @param {string} to - Destination path.
 * @param {number} [attempts] - Total tries before giving up.
 * @returns {Promise<void>} Resolves once the rename has happened.
 * @throws {Error} The last failure, when every attempt failed.
 */
async function renameWithRetry(from, to, attempts = 5) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = error?.code
      const transient = code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
      if (attempt >= attempts || transient === false) throw error
      await new Promise((resolve) => { setTimeout(resolve, 25 * attempt) })
    }
  }
}

/**
 * Write the document, atomically, and report the revision it landed as.
 *
 * Written to a sibling temp file and renamed into place: a half-written JSON document is the one
 * failure the panel could not recover from, because it would lose every favorite rather than the
 * last change. Writes are also chained, so two requests cannot fight over the same temp path.
 *
 * @param {object} document - The document to store.
 * @returns {Promise<number>} The file's mtime, in milliseconds — the revision the client compares.
 */
function writePanelState(document) {
  const file = panelStateFile()
  const text = `${JSON.stringify(document, null, 2)}\n`
  const run = async () => {
    await mkdir(dirname(file), { recursive: true })
    const temporary = `${file}.tmp`
    await writeFile(temporary, text)
    await renameWithRetry(temporary, file)
    return (await stat(file)).mtimeMs
  }
  // A failed write must not poison the chain: the next one still has to run.
  const next = panelWriteChain.then(run, run)
  panelWriteChain = next.then(() => undefined, () => undefined)
  return next
}

/**
 * Answer `GET /state`: the stored document and the two facts the panel needs alongside it.
 * @param {import('node:http').ServerResponse} res - Response to own.
 * @returns {Promise<void>} Resolves once answered.
 */
async function handlePanelStateRead(res) {
  const state = await readPanelState()
  let revision = 0
  try {
    revision = (await stat(panelStateFile())).mtimeMs
  } catch {
    revision = 0
  }
  sendJson(res, 200, { ok: true, state, revision, harnessStartedAt: HOST_STARTED_AT })
}

/**
 * Answer `POST /state`: replace the stored document with the one in the body.
 * @param {import('node:http').IncomingMessage} req - Incoming request.
 * @param {import('node:http').ServerResponse} res - Response to own.
 * @returns {Promise<void>} Resolves once answered.
 */
async function handlePanelStateWrite(req, res) {
  try {
    // A body larger than the ceiling is refused from its own header, before a byte is read.
    // Reading first would destroy the request stream mid-body — which is what the reader does when
    // it gives up — and a destroyed request cannot be answered: the client would see a reset
    // instead of the reason. A chunked body (no `content-length`) still falls through to the
    // reader's own ceiling, where the reset is the only honest outcome.
    const declared = Number(req.headers['content-length'] ?? 0)
    if (Number.isFinite(declared) && declared > MAX_PANEL_STATE_BYTES) {
      throw badRequest(`请求体过大（上限 ${Math.round(MAX_PANEL_STATE_BYTES / 1024 / 1024)} MB）`)
    }
    const body = await readJsonBody(req, MAX_PANEL_STATE_BYTES)
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw badRequest('面板状态必须是一个 JSON 对象')
    }
    const revision = await writePanelState(body)
    sendJson(res, 200, { ok: true, revision, harnessStartedAt: HOST_STARTED_AT })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    // An unread body cannot be followed by another request on the same connection: saying so is
    // what stops the remainder from being interpreted as one.
    send(
      res,
      error?.badRequest === true ? 400 : 500,
      JSON.stringify({ error: `面板状态保存失败：${reason}` }),
      { connection: 'close' },
    )
  }
}

/**
 * Handle one request under the plugin's prefix.
 * @param {import('node:http').IncomingMessage} req - Incoming request.
 * @param {import('node:http').ServerResponse} res - Response to own.
 * @param {InstalledSkillRegistry} registry - Live registration owner.
 * @returns {Promise<void>} Resolves once the response has been written.
 */
async function handle(req, res, registry) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const suffix = url.pathname.slice(ROUTE_PREFIX.length)
  const method = req.method ?? 'GET'

  /* ── reads (GET) ───────────────────────────────────────────────────── */
  if (method === 'GET' || method === 'HEAD') {
    if (suffix === '/state') {
      await handlePanelStateRead(res)
      return
    }
    if (suffix === '/category-counts') {
      try {
        sendJson(res, 200, { counts: await categoryCounts() })
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        sendError(res, 502, `技能分类计数请求失败：${reason}`)
      }
      return
    }
    if (suffix === '/skill-file') {
      await handleSkillFile(res, url)
      return
    }
    // The safety verdict on its own. The reports live in the detail response, which is 2.3 KB and
    // carries the whole description — too much to pull once per card. This reuses the same cached
    // detail fetch and answers with a couple of hundred bytes, so a screen of cards is cheap and
    // the verdict is computed in one place instead of being re-derived per view.
    if (suffix === '/skill-security') {
      try {
        const target = skillSubresourceUrl(url, '')
        const { entry } = await fetchUpstream(target)
        if (entry.status !== 200) {
          sendError(res, entry.status, `技能安全信息请求失败：上游返回 ${String(entry.status)}`)
          return
        }
        const parsed = JSON.parse(entry.body)
        const reports = parsed?.securityReports ?? parsed?.data?.securityReports
        sendJson(res, 200, safetyVerdict(reports))
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        sendError(res, error?.badRequest === true ? 400 : 502, `技能安全信息请求失败：${reason}`)
      }
      return
    }
    let target
    if (suffix === '/skills') target = skillsUpstreamUrl(url)
    else if (suffix === '/categories') target = `${UPSTREAM}/api/v1/categories`
    else if (suffix === '/skill-detail') target = skillSubresourceUrl(url, '')
    else if (suffix === '/skill-versions') target = skillSubresourceUrl(url, '/versions')
    else if (suffix === '/skill-files') target = skillSubresourceUrl(url, '/files')
    else if (suffix === '/installed') {
      sendJson(res, 200, await registry.summary())
      return
    } else {
      sendError(res, 404, `未知的技能市场接口：${suffix}`)
      return
    }
    try {
      const { entry, cache: cacheState } = await fetchUpstream(target)
      send(res, entry.status, entry.body, { 'x-skill-market-cache': cacheState })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      sendError(res, error?.badRequest === true ? 400 : 502, `技能市场上游请求失败：${reason}`)
    }
    return
  }

  if (method !== 'POST') {
    sendError(res, 405, '只支持 GET 与 POST 请求')
    return
  }

  /* ── writes (POST) ─────────────────────────────────────────────────── */

  // The panel's own document. Handled before the generic JSON read below because it has its own
  // (much larger) size ceiling: it is the only body that grows with how much the user has saved.
  if (suffix === '/state') {
    await handlePanelStateWrite(req, res)
    return
  }

  // The import body is the file itself, so it is read as bytes before any JSON parsing.
  if (suffix === '/import') {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const bytes = await readBinaryBody(req, MAX_IMPORT_BYTES)
      const result = await importLocalSkill({ name: url.searchParams.get('name') ?? '', bytes })
      // Publish it to the running session right away, like an install.
      const summary = await registry.sync()
      sendJson(res, 200, { ok: true, import: result, installed: summary })
    } catch (error) {
      sendError(res, 500, error instanceof Error ? error.message : String(error))
    }
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch (error) {
    sendError(res, 400, `请求体无法解析：${error instanceof Error ? error.message : String(error)}`)
    return
  }

  if (suffix === '/install') {
    try {
      const result = await installSkill(body)
      // Publish the freshly written skill to the running session right away.
      const summary = await registry.sync()
      sendJson(res, 200, { ok: true, install: result, installed: summary })
    } catch (error) {
      sendError(res, 500, error instanceof Error ? error.message : String(error))
    }
    return
  }

  if (suffix === '/uninstall') {
    try {
      const result = await uninstallSkill(body)
      const summary = await registry.sync()
      sendJson(res, 200, { ok: true, uninstall: result, installed: summary })
    } catch (error) {
      sendError(res, 500, error instanceof Error ? error.message : String(error))
    }
    return
  }

  if (suffix === '/enabled') {
    try {
      const directory = String(body?.directory ?? '')
      const enabled = body?.enabled !== false
      const summary = await registry.setEnabled(directory, enabled)
      sendJson(res, 200, { ok: true, installed: summary })
    } catch (error) {
      sendError(res, 500, error instanceof Error ? error.message : String(error))
    }
    return
  }

  sendError(res, 404, `未知的技能市场接口：${suffix}`)
}

/**
 * Register the proxy and install routes, and publish installed skills live.
 *
 * The skill registry is an optional service, so it is injected: a profile without
 * it still serves market data and can still install to disk, it just has no
 * catalog to publish into.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host plugin context.
 * @returns {void}
 */
export function apply(ctx) {
  const registry = new InstalledSkillRegistry(ctx)
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: (req, res) => handle(req, res, registry),
    }),
    '@montersy123/dsh-skill-market: routes',
  )
  ctx.inject(['skills'], (scoped) => {
    // `ctx.skills.register()` is owned by the calling context, so registering
    // through `scoped` ties the live skills to this plugin's lifetime.
    registry.ctx = scoped
    scoped.effect(
      () => () => {
        for (const directory of [...registry.live.keys()]) registry.unregister(directory)
      },
      '@montersy123/dsh-skill-market: withdraw live skills',
    )
    migrateLegacyRoot()
      .then(() => migrateDisabledMarks())
      // Records written before identity was stored point at a namespace that does not exist, because
      // the directory name sanitises `_` to `-`. This asks the catalogue for the real one.
      .then(() => repairInstallIdentity())
      // After the migration has taken what it needs, make sure the tree exists — the store and
      // the data directory are permanent now, so an empty install still has both.
      .then(() => ensureStateTree())
      .catch((error) => { scoped.logger?.warn?.(`skill-market: migration failed: ${String(error)}`) })
      .then(() => registry.start())
      .then((summary) => {
        const off = summary.skills.filter((skill) => !skill.enabled).length
        scoped.logger?.debug?.(`skill-market: ${String(summary.skills.length - off)} skill(s) enabled, ${String(off)} disabled`)
      })
      .catch((error) => { scoped.logger?.warn?.(`skill-market: failed to publish installed skills: ${String(error)}`) })
  })
}

/**
 * Create the state tree if it is not there yet, and leave it alone if it is.
 *
 * Both `data/` and `data/skills` are permanent. An earlier build pruned whichever became
 * empty, so the tree appeared and disappeared with the current set of parked skills — noisy,
 * and it put the version record one accident from deletion because the record lives in the
 * same directory. An always-present store is also easier to reason about: "nothing is
 * disabled" is an empty directory rather than a missing one, so no code has to treat absence
 * as a second spelling of the same thing.
 *
 * Failure is not fatal: a state directory that cannot be created must not stop activation,
 * and toggling a skill reports its own error if the store really is unusable.
 *
 * @returns {Promise<void>} Resolves once the tree exists, or after a failure that is tolerated.
 */
async function ensureStateTree() {
  await mkdir(disabledRoot(), { recursive: true }).catch(() => {})
}

/**
 * Re-exported for tests: count the skills in every active top-level category.
 * @returns {Promise<Record<string, number>>} Counts keyed by category.
 */
export function categoryCountsForTest() {
  return categoryCounts()
}

/**
 * Re-exported for tests: the resolved skill root this plugin installs into.
 * @returns {string} Absolute directory.
 */
export function installedSkillRoot() {
  return skillRoot()
}

/** Re-exported for tests: relative path of `child` under `parent`, or null. */
export function relativeInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || rel.startsWith('..') ? null : rel
}

/**
 * Re-exported for tests: run one install without a web carrier.
 * @param {object} request - Install request.
 * @param {(progress: object) => void} [onProgress] - Progress sink.
 * @returns {Promise<object>} Install result.
 */
export function installSkillForTest(request, onProgress) {
  return installSkill(request, onProgress)
}

/**
 * Re-exported for tests: move skills from the legacy root into the shared root.
 * @returns {Promise<string[]>} Names that were moved.
 */
export function migrateLegacyRootForTest() {
  return migrateLegacyRoot()
}

/**
 * Re-exported for tests: park skills an earlier build only marked disabled.
 * @returns {Promise<string[]>} Directory names that were parked.
 */
export function migrateDisabledMarksForTest() {
  return migrateDisabledMarks()
}

/**
 * Re-exported for tests: backfill upstream namespaces into older install records.
 * @param {typeof fetch} [fetchImpl] - Injected transport, so no test needs the network.
 * @returns {Promise<{repaired: string[], unresolved: string[]}>} Repair outcome.
 */
export function repairInstallIdentityForTest(fetchImpl) {
  return repairInstallIdentity(fetchImpl)
}

/**
 * Re-exported for tests: build one skill's upstream sub-resource URL from a request.
 * @param {string} query - Raw query string, with or without a leading `?`.
 * @param {string} resource - `''`, `'/versions'` or `'/files'`.
 * @returns {string} Absolute upstream URL.
 */
export function skillSubresourceUrlForTest(query, resource) {
  return skillSubresourceUrl(new URL(`/skill-market/api/skill-detail${query.startsWith('?') ? query : `?${query}`}`, 'http://localhost'), resource)
}

/**
 * Re-exported for tests: import a local skill package.
 * @param {{name: string, bytes: Buffer}} request - Original filename and uploaded bytes.
 * @returns {Promise<object>} Import result.
 */
export function importLocalSkillForTest(request) {
  return importLocalSkill(request)
}

/**
 * Re-exported for tests: read a ZIP archive's entries without unpacking it.
 * @param {Buffer} buffer - Whole archive.
 * @returns {Array<object>} Entries.
 */
export function readZipEntriesForTest(buffer) {
  return readZipEntries(buffer)
}

/**
 * Re-exported for tests: locate an installed skill in whichever root holds it.
 * @param {string} directoryName - `<handle>--<slug>`.
 * @returns {object | undefined} Location, or undefined when absent.
 */
export function locateInstalledForTest(directoryName) {
  return locateInstalled(directoryName)
}

/**
 * Re-exported for tests: validate one upstream path segment (slug or handle).
 * @param {unknown} value - Raw value.
 * @param {string} label - Parameter name for the error message.
 * @returns {string} The validated value.
 * @throws {Error} Tagged as a bad request when missing or malformed.
 */
export function safeUpstreamNameForTest(value, label) {
  return safeUpstreamName(value, label)
}

/**
 * Re-exported for tests: reject a skill name the registry would refuse on load.
 * @param {string} name - Declared `name` from a `SKILL.md`.
 * @returns {void}
 * @throws {Error} When the name is not the registry's grammar.
 */
export function assertSkillNameForTest(name) {
  assertSkillName(name)
}

/**
 * Re-exported for tests: reduce upstream's security reports to one verdict.
 * @param {unknown} reports - Raw `securityReports`.
 * @returns {{verdict: string, vendors: Array<object>}} Normalised verdict.
 */
export function safetyVerdictForTest(reports) {
  return safetyVerdict(reports)
}

/**
 * Re-exported for tests: the plugin's own data directory.
 * @returns {string} Absolute directory.
 */
export function pluginDataRootForTest() {
  return pluginDataRoot()
}

/**
 * Re-exported for tests: the file the browser half's state is stored in.
 * @returns {string} Absolute file path.
 */
export function panelStateFileForTest() {
  return panelStateFile()
}

/**
 * Re-exported for tests: scan the skill root the way the live registry does.
 * @returns {Promise<Array<object>>} Installed skills.
 */
export function scanInstalledForTest() {
  return scanInstalled()
}

/**
 * Re-exported for tests: own the live registrations without a plugin context.
 *
 * The real `ctx.skills.register()` is used, so a test can assert what the running
 * session would actually see — including that disabling a skill withdraws it.
 *
 * @param {object} ctx - A context carrying `skills` and an optional `logger`.
 * @returns {InstalledSkillRegistry} The controller.
 */
export function registryForTest(ctx) {
  return new InstalledSkillRegistry(ctx)
}

/**
 * Re-exported for tests: where the enable/disable decisions are persisted.
 * @returns {string} Absolute state file path.
 */
export function disabledRootForTest() {
  return disabledRoot()
}

/**
 * Re-exported for tests: remove one installed skill.
 * @param {object} request - Uninstall request.
 * @returns {Promise<object>} Removal result.
 */
export function uninstallSkillForTest(request) {
  return uninstallSkill(request)
}
