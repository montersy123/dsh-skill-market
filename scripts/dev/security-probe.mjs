/**
 * Probe the safety-scan fields the 安全 badge depends on.
 *
 * Everything here was measured, not assumed, and each measurement changed the implementation:
 *
 *   `securityReports` lives only on the **detail** response, at its top level — not in
 *   `data.skill`, and not in the list response at all. That is why the badge needs its own
 *   per-skill request instead of riding along with the page of cards.
 *
 *   `status` has more than two values: `benign`, `suspicious`, `queued`. A badge that treats
 *   "not suspicious" as safe would claim safety for a scan that has not run yet.
 *
 *   Vendors disagree. `ima-skills` is `benign` from `keen` and `suspicious` from `sanbu`, so the
 *   verdict has to require **every** vendor to be benign.
 *
 *   The `reportUrl`s do open, despite carrying `q-sign-time` parameters: every one sampled answered
 *   200, `keen` with the threat-intelligence page and `sanbu` with a per-skill report.
 *
 *   node scripts/security-probe.mjs [pages]        statuses, vendors, disagreements
 *   node scripts/security-probe.mjs --links        whether the report URLs are openable
 */
const pages = Number.parseInt(process.argv.find((value) => /^\d+$/.test(value)) ?? '3', 10)
const wantLinks = process.argv.includes('--links')

const statuses = new Map()
const vendors = new Map()
const disagreements = []
const sampleLinks = []

for (let page = 1; page <= pages; page += 1) {
  const list = await (await fetch(
    `https://api.skillhub.cn/api/skills?page=${page}&pageSize=20&sortBy=score&order=desc`,
  )).json()
  for (const entry of list.data.skills ?? []) {
    const detail = await (await fetch(
      `https://api.skillhub.cn/api/v1/skills/${entry.slug}?namespace=${entry.namespace.handle}`,
    )).json()
    const reports = detail?.securityReports ?? {}
    const found = Object.entries(reports)
    if (found.length === 0) continue
    for (const [vendor, report] of found) {
      vendors.set(vendor, (vendors.get(vendor) ?? 0) + 1)
      statuses.set(String(report?.status), (statuses.get(String(report?.status)) ?? 0) + 1)
    }
    const distinct = new Set(found.map(([, report]) => report?.status))
    if (distinct.size > 1) {
      disagreements.push(`${entry.slug.padEnd(20)} ${found.map(([v, r]) => `${v}=${r?.status}`).join(', ')}`)
    }
    if (wantLinks) {
      for (const [vendor, report] of found) {
        if (sampleLinks.length >= 6 || typeof report?.reportUrl !== 'string' || report.reportUrl === '') continue
        sampleLinks.push({ slug: entry.slug, vendor, status: report.status, url: report.reportUrl })
      }
    }
  }
}

console.log('statuses seen:')
for (const [status, count] of [...statuses].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${status.padEnd(12)} ${count}`)
}
console.log('\nvendors:')
for (const [vendor, count] of [...vendors].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${vendor.padEnd(8)} ${count}`)
}
console.log(`\nskills whose vendors disagree: ${disagreements.length}`)
for (const line of disagreements) console.log('  ' + line)

if (wantLinks) {
  console.log('\nreport links:')
  for (const item of sampleLinks) {
    let outcome
    try {
      const response = await fetch(item.url, { redirect: 'follow' })
      const type = (response.headers.get('content-type') ?? '').split(';')[0]
      const body = type.includes('html') ? await response.text() : ''
      const title = /<title[^>]*>([^<]*?)\s*<\/title>/i.exec(body)
      outcome = `HTTP ${response.status} ${body.length}B title=${title === null ? '(none)' : JSON.stringify(title[1].slice(0, 44))}`
    } catch (error) {
      outcome = `ERROR ${error.message}`
    }
    console.log(`  ${item.slug.padEnd(18)} ${item.vendor.padEnd(7)} ${item.status.padEnd(10)} ${outcome}`)
  }
}
