/**
 * Report what the real client plugin context actually exposes, before any code depends on it.
 *
 * The panel is about to be translated against `ctx.locale`, and that service's *host* documentation
 * describes a host-side API. Guessing the client-side shape would produce a panel that either crashes
 * on mount or silently renders raw keys, and the failure would only surface after a restart. This runs
 * under the real Cordis client runtime and prints the services and methods that are really there.
 *
 *   node --import ./scripts/asar-resolver.mjs scripts/client-context-probe.mjs
 */
const { createClientHarness } = await import('./cordis-harness.mjs')

const harness = await createClientHarness()
const ctx = harness.ctx

const services = Object.keys(ctx).filter((key) => key.startsWith('_') === false).sort()
console.log('  client context keys:')
for (const key of services) console.log(`    ${key}`)

console.log('')
if (ctx.locale === undefined) {
  console.log('  ctx.locale: ABSENT from the client context')
} else {
  console.log('  ctx.locale methods:')
  const own = new Set(Object.keys(ctx.locale))
  for (const proto of [Object.getPrototypeOf(ctx.locale), Object.getPrototypeOf(Object.getPrototypeOf(ctx.locale))]) {
    if (proto === null) continue
    for (const key of Object.getOwnPropertyNames(proto)) if (key !== 'constructor') own.add(key)
  }
  for (const key of [...own].sort()) {
    const value = ctx.locale[key]
    console.log(`    ${key}  (${typeof value}${typeof value === 'function' ? `, arity ${String(value.length)}` : ''})`)
  }
}

// The `t` seat the framework hands to slot components, which is the documented consumer path.
console.log('')
const entry = harness.panelEntry ?? null
console.log('  panel entry inject list:', JSON.stringify(entry?.inject ?? null))

await harness.dispose?.()
