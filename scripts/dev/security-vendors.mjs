/**
 * Enumerate every security-scan vendor code upstream reports.
 *
 * The panel wants to render a fixed two-row layout (科恩实验室 / 云鼎实验室), which is only safe if the
 * set really is fixed. This sweeps a wide sample and reports the complete set of keys seen, so the
 * decision to hard-code is based on a measurement rather than on the two that happened to show up.
 *
 *   node scripts/security-vendors.mjs [pages]
 */
const pages = Number.parseInt(process.argv[2] ?? '10', 10)

const vendors = new Map()
const samples = new Map()
let skills = 0
let missing = 0

for (let page = 1; page <= pages; page += 1) {
  const list = await (await fetch(
    `https://api.skillhub.cn/api/skills?page=${page}&pageSize=20&sortBy=score&order=desc`,
  )).json()
  const rows = list.data.skills ?? []
  if (rows.length === 0) break
  for (const entry of rows) {
    skills += 1
    const detail = await (await fetch(
      `https://api.skillhub.cn/api/v1/skills/${entry.slug}?namespace=${entry.namespace.handle}`,
    )).json()
    const reports = detail?.securityReports ?? {}
    const keys = Object.keys(reports)
    if (keys.length === 0) { missing += 1; continue }
    for (const key of keys) {
      vendors.set(key, (vendors.get(key) ?? 0) + 1)
      if (samples.has(key) === false) {
        samples.set(key, {
          text: String(reports[key]?.statusText ?? ''),
          status: String(reports[key]?.status ?? ''),
          url: String(reports[key]?.reportUrl ?? '').slice(0, 78),
        })
      }
    }
  }
}

console.log(`  skills examined      : ${skills}`)
console.log(`  without any report   : ${missing}`)
console.log(`  distinct vendor codes: ${vendors.size}`)
console.log('')
for (const [vendor, count] of [...vendors].sort((a, b) => b[1] - a[1])) {
  const sample = samples.get(vendor)
  console.log(`  ${vendor.padEnd(10)} ${String(count).padStart(4)}  ${sample.status.padEnd(11)} ${JSON.stringify(sample.text)}`)
  console.log(`             sample url: ${sample.url === '' ? '(none)' : sample.url}`)
}

// A vendor code that also appears in the page markup would confirm the display name to use, so the
// public page for one skill is checked for the Chinese names seen in the product.
const probe = await (await fetch('https://skillhub.cn/skills/indiv-ebandao/dev-expert')).text()
console.log('')
for (const name of ['科恩实验室', '云鼎实验室', 'keen', 'sanbu']) {
  console.log(`  page mentions ${name.padEnd(12)}: ${probe.includes(name)}`)
}
