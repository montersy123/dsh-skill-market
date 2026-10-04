/**
 * Run the panel's own detail request for an installed skill, using the identifiers it derives.
 *
 * "The detail page will not load" for two freshly installed skills, whose `SKILL.md` names are valid —
 * so the fault is not the name guard. This reproduces exactly what the drawer asks for, from the
 * directory name up, to find which step diverges.
 *
 *   node --import ./scripts/asar-resolver.mjs scripts/detail-path-check.mjs
 */
const mod = await import('@montersy123/dsh-skill-market')

const summary = await mod.registryForTest({
  skills: { register: () => () => {} },
  logger: { warn() {}, debug() {} },
}).summary()

console.log(`  installed rows: ${summary.skills.length}\n`)

for (const row of summary.skills) {
  const directoryName = String(row.directoryName)
  const [handle, ...slugParts] = directoryName.split('--')
  const slug = slugParts.join('--')
  console.log(`${directoryName}`)
  console.log(`  derived handle : ${handle}`)
  console.log(`  derived slug   : ${slug}`)
  console.log(`  reported name  : ${JSON.stringify(row.name)}`)

  // 1. Does upstream know this namespace/slug at all?
  const detailUrl = `https://api.skillhub.cn/api/v1/skills/${encodeURIComponent(slug)}?namespace=${encodeURIComponent(handle)}`
  try {
    const response = await fetch(detailUrl)
    const body = await response.text()
    console.log(`  upstream detail: HTTP ${response.status} (${body.length} B)`)
    if (response.status !== 200) {
      console.log(`    -> the drawer would fail here; body: ${body.slice(0, 120)}`)
    }
  } catch (error) {
    console.log(`  upstream detail: ERROR ${error.message}`)
  }

  // 2. Is the directory name's handle even a real namespace? The slug alone should reveal the owner.
  try {
    const search = await (await fetch(
      `https://api.skillhub.cn/api/skills?page=1&pageSize=20&sortBy=score&order=desc&keyword=${encodeURIComponent(slug)}`,
    )).json()
    const matches = (search.data?.skills ?? []).filter((s) => s.slug === slug)
    if (matches.length === 0) {
      console.log(`  catalogue      : slug "${slug}" not found by keyword search`)
    }
    for (const match of matches) {
      console.log(`  catalogue      : namespace=${match.namespace.handle}  canonical=${match.namespace.canonicalName}`)
      if (match.namespace.handle !== handle) {
        console.log(`    -> MISMATCH: the directory says "${handle}", upstream says "${match.namespace.handle}"`)
      }
    }
  } catch (error) {
    console.log(`  catalogue      : ERROR ${error.message}`)
  }
  console.log('')
}
