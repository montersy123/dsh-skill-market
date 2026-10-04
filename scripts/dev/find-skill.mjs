/**
 * Look up a skill by slug across the ways where it might be reachable.
 *
 * A skill installed from a listing is found by keyword search, but the repair that recovers a lost
 * namespace relies on that search — so "the record cannot be repaired" and "the skill is not in the
 * catalogue" are different answers that need telling apart.
 *
 *   node scripts/find-skill.mjs <slug>
 */
const slug = process.argv[2] ?? 'find-skills'

console.log(`=== keyword search for ${JSON.stringify(slug)} ===`)
const search = await (await fetch(
  `https://api.skillhub.cn/api/skills?page=1&pageSize=20&sortBy=score&order=desc&keyword=${encodeURIComponent(slug)}`,
)).json()
const rows = search.data?.skills ?? []
console.log(`  ${rows.length} row(s)`)
for (const row of rows.slice(0, 8)) {
  const mark = row.slug === slug ? ' <-- exact slug' : ''
  console.log(`    ${String(row.namespace.handle).padEnd(22)} ${String(row.slug).padEnd(28)}${mark}`)
}

console.log('')
console.log('=== sweeps across sorted pages ===')
for (const sortBy of ['score', 'latest', 'downloads']) {
  let found = null
  for (let page = 1; page <= 10 && found === null; page += 1) {
    const body = await (await fetch(
      `https://api.skillhub.cn/api/skills?page=${page}&pageSize=20&sortBy=${sortBy}&order=desc`,
    )).json()
    for (const row of body.data?.skills ?? []) {
      if (row.slug === slug) found = { page, namespace: row.namespace.handle, name: row.name }
    }
    if ((body.data?.skills ?? []).length === 0) break
  }
  console.log(`  sortBy=${sortBy.padEnd(10)} ${found === null ? 'not found in 200 rows' : `found on page ${found.page}: namespace=${found.namespace} name=${JSON.stringify(found.name)}`}`)
}

console.log('')
console.log('=== direct detail probes ===')
for (const namespace of ['clawhub-root', 'clawhub_root', 'clawhub', 'guipi']) {
  const url = `https://api.skillhub.cn/api/v1/skills/${encodeURIComponent(slug)}?namespace=${encodeURIComponent(namespace)}`
  try {
    const response = await fetch(url)
    console.log(`  namespace=${namespace.padEnd(14)} HTTP ${response.status}`)
  } catch (error) {
    console.log(`  namespace=${namespace.padEnd(14)} ERROR ${error.message}`)
  }
}
