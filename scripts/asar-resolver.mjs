/**
 * ESM resolve hook that redirects bare `@deepseek-ai/*` and vendor imports to
 * the copies extracted from `app.asar` under `scripts/dev/asar-out/dsh/node_modules`,
 * so the kernel and Cordis can be imported straight from the installation.
 *
 *   node --import ./scripts/asar-resolver.mjs <script>
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./scripts/asar-resolver-hooks.mjs').href)
