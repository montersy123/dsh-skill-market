/**
 * Compare the two ways the panel builds a skill id, for the skills actually on disk.
 *
 * "Installed on the catalog card" depends on the id in the ledger-row matching the id of the catalog
 * card. Those ids are built on opposite sides of a lossy boundary:
 *
 *   Host  : derives the row's id from the directory name (`<handle>--<slug>`)
 *   Client: builds the card's id from the catalogue's `namespace.canonicalName`
 *
 * If the namespace contains characters the directory name cannot hold, the two never agree and every
 * installed skill reads as "not installed". This prints both, for real data, so the mismatch is a
 * measurement rather than a theory.
 *
 *   node --import ./scripts/asar-resolver.mjs scripts/id-shape-check.mjs
 */
const mod = await import('@montersy123/dsh-skill-market')

const summary = await mod.registryForTest({
  skills: { register: () => () => {} },
  logger: { warn() {}, debug() {} },
}).summary()

/**
 * The id the client builds for an installed row, mirroring its **current** rule: the Host's upstream
 * identifiers first, the directory name only as a fallback. Reading the directory name unconditionally
 * was the bug — it produced `@clawhub-root/find-skills` while the catalogue uses
 * `@clawhub_root/find-skills`, so every card read "not installed".
 */
const rowId = (row) => {
  const directoryName = String(row.directoryName ?? '')
  const [directoryHandle, ...directorySlugParts] = directoryName.split('--')
  const handle = String(row.handle ?? '').trim() || directoryHandle
  const slug = String(row.slug ?? '').trim() || directorySlugParts.join('--')
  return `@${handle}/${slug}`
}

console.log('  installed rows\n')
for (const row of summary.skills) {
  console.log(`  ${row.directoryName}`)
  console.log(`    Host  handle = ${row.handle}`)
  console.log(`    Host  slug   = ${row.slug}`)
  console.log(`    row id       = ${rowId(row)}`)

  // What the catalogue says for the same skill, which is what a card is built from.
  const url = `https://api.skillhub.cn/api/v1/skills/${encodeURIComponent(row.slug)}?namespace=${encodeURIComponent(row.handle)}`
  const response = await fetch(url)
  console.log(`    detail       = HTTP ${response.status}`)
  if (response.status !== 200) { console.log(''); continue }
  const body = await response.json()
  const canonical = body?.namespace?.canonicalName ?? body?.skill?.namespace?.canonicalName ?? ''
  console.log(`    catalogue canonicalName = ${JSON.stringify(canonical)}`)
  const cardId = canonical === '' ? '(unknown)' : canonical
  console.log(`    card id      = ${cardId}`)
  console.log(`    MATCH        = ${cardId === rowId(row) ? 'yes' : 'NO  <-- catalog card will say "not installed"'}`)
  console.log('')
}

// And the catalogue entry as the LIST endpoint reports it, which is the path the panel actually uses
// to build cards — the detail endpoint above is only a cross-check.
console.log('  --- catalogue rows as /api/skills reports them ---')
for (const row of summary.skills) {
  const search = await (await fetch(
    `https://api.skillhub.cn/api/skills?page=1&pageSize=20&sortBy=score&order=desc&keyword=${encodeURIComponent(row.slug)}`,
  )).json()
  const matches = (search.data?.skills ?? []).filter((entry) => entry.slug === row.slug)
  if (matches.length === 0) {
    console.log(`  ${row.directoryName}: not in the top 20 for its own slug`)
    continue
  }
  for (const match of matches) {
    const canonical = match.namespace?.canonicalName ?? ''
    console.log(`  ${match.slug}`)
    console.log(`    namespace.handle        = ${match.namespace?.handle}`)
    console.log(`    namespace.canonicalName = ${canonical}`)
    console.log(`    row id                  = ${rowId(row)}`)
    console.log(`    MATCH                   = ${canonical === rowId(row) ? 'yes' : 'NO'}`)
  }
}
