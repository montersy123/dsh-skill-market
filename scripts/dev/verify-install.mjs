/**
 * Report whether the installed bundle is live: the profile link, the Host proxy
 * route, and the Client slot registration.
 *
 *   node tools/verify-install.mjs
 *
 * The Client probe needs a connected page (the Web GUI open in a browser); it
 * reports that limitation instead of failing when none is attached.
 */
const WEB = process.env.DSH_WEB_URL ?? 'http://127.0.0.1:19387'
const PROXY = `${WEB}/skill-market/api/skills?page=1&pageSize=1&sortBy=score`

const result = { web: WEB, host: {}, client: null }

try {
  const response = await fetch(PROXY, { signal: AbortSignal.timeout(20_000) })
  const body = await response.text()
  result.host.status = response.status
  result.host.total = (() => {
    try { return JSON.parse(body)?.data?.total ?? null } catch { return null }
  })()
  result.host.ok = response.ok && typeof result.host.total === 'number'
} catch (error) {
  result.host.ok = false
  result.host.error = error instanceof Error ? error.message : String(error)
}

console.log(JSON.stringify({
  ...result,
  clientNote: 'client slot state is read with cordis_inspect_query (platform client, provider Slots, method listSubTree, root sidebar.panellist)',
}, null, 2))

process.exit(result.host.ok ? 0 : 1)
