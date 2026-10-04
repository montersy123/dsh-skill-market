/**
 * Ask SkillHub for the current number of skills, the way the plugin itself does.
 *
 * The count belongs in the catalog description only if it is true, and the contributing guide says a number in a
 * description is checked against the code. A captured fixture records what the number was when it was captured,
 * which is not the same claim. Prints the live value, or says so plainly when the upstream refuses.
 */
const UPSTREAM = 'https://api.skillhub.cn'

// `/api/skills` is the listing; `/api/v1/skills/<slug>` is a single skill. Getting that wrong yields a 405, which
// is how this was found rather than assumed.
const request = await fetch(`${UPSTREAM}/api/skills?page=1&pageSize=1&sortBy=score&order=desc`, {
  headers: { 'user-agent': '@montersy123/dsh-skill-market/0.1 (+https://skillhub.cn)' },
  signal: AbortSignal.timeout(30_000),
})

console.log(`  HTTP ${String(request.status)} ${request.headers.get('content-type') ?? ''}`)

if (request.ok === false) {
  console.log('  the upstream refused this request; no live count available')
  process.exit(1)
}

const payload = await request.json()
const total = payload?.data?.total
console.log(`  live total: ${String(total)}`)

// Whatever the count is, report it as of now rather than implying it is stable.
console.log(`  as of     : ${new Date().toISOString()}`)
