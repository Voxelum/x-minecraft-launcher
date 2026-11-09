import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * CI guard for the fail-closed telemetry contract:
 * 1. Telemetry must be enabled iff `telemetryConsent === 'granted'`
 *    (no telemetry-on-by-default regression).
 * 2. `trackException` in the telemetry pipeline must redact stacks.
 * 3. Telemetry must never be linked to the XMCL Together account.
 */
function fail(message: string): never {
  console.error(`✗ telemetry parity: ${message}`)
  process.exit(1)
}

const repoRoot = resolve(__dirname, '..')

const settingSchema = readFileSync(
  resolve(repoRoot, 'xmcl-runtime-api/src/entities/setting.schema.ts'),
  'utf-8',
)
if (!/telemetryConsent:\s*z\.enum\(\['unset',\s*'granted',\s*'denied'\]\)/.test(settingSchema)) {
  fail('setting.schema.ts is missing the telemetryConsent enum')
}

const telemetryPlugin = readFileSync(
  resolve(repoRoot, 'xmcl-runtime/infra/plugins/telemetry.ts'),
  'utf-8',
)
const consentGates = telemetryPlugin.match(/settings\.telemetryConsent !== 'granted'/g) ?? []
if (consentGates.length < 5) {
  fail(`expected >=5 consent gates in plugins/telemetry.ts, found ${consentGates.length}`)
}
if (/settings\.disableTelemetry/.test(telemetryPlugin)) {
  fail('plugins/telemetry.ts still gates on the legacy disableTelemetry flag')
}

const telemetryContext = readFileSync(
  resolve(repoRoot, 'xmcl-runtime/infra/telemetry_context.ts'),
  'utf-8',
)
if (!/redactStack\(exception\.stack\)/.test(telemetryContext)) {
  fail('trackException does not redact stack traces')
}
if (!/redactStack\(action\.error\??\.stack\)/.test(telemetryContext)) {
  fail('endRendererAction does not redact error stacks')
}
if (/setRuntimeTelemetryUserId/.test(telemetryContext)) {
  fail('telemetry_context.ts must not support account-scoped user ids')
}

const peerService = readFileSync(resolve(repoRoot, 'xmcl-runtime/peer/PeerService.ts'), 'utf-8')
if (/getTelemetryAccountId: \(\) => [^u]/.test(peerService)) {
  fail('PeerService must not forward the account id to multiplayer telemetry')
}

const rendererTrack = readFileSync(
  resolve(repoRoot, 'xmcl-keystone-ui/src/composables/telemetryTrack.ts'),
  'utf-8',
)
if (!/telemetryConsent === 'granted'/.test(rendererTrack)) {
  fail('renderer telemetry tracking does not follow telemetryConsent')
}

const redactTest = resolve(repoRoot, 'xmcl-runtime/infra/telemetry_redact.test.ts')
if (!existsSync(redactTest)) {
  fail('missing unit tests for telemetry_redact')
}

console.log('✓ telemetry parity: consent gate, redaction, and device-scoped identity all hold')
