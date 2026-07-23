import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const DIAGNOSE_USAGE = 'diagnose [client|server|java]'

function compatLabel(compatible: number | undefined): string {
  if (compatible === undefined) return 'unknown'
  if (compatible === 0) return 'matched'
  if (compatible === 1) return 'may-incompatible'
  if (compatible === 2) return 'very-likely-incompatible'
  return String(compatible)
}

function diagnoseJava(cli: CliContext) {
  const status = cli.ctx.javaStatus.value
  if (!status) return { available: false, note: 'No Java status yet (no instance selected or version not resolved).' }
  const selected = status.java
  return {
    available: true,
    issue: cli.ctx.javaIssue.value ?? 'none',
    noJavaFound: !!status.noJava,
    requiredMajorVersion: status.javaVersion?.majorVersion,
    compatibility: compatLabel(status.compatible),
    selectedJava: selected
      ? { path: selected.path, version: selected.version, majorVersion: selected.majorVersion, valid: selected.valid }
      : null,
    installedJavas: cli.ctx.javaList.value.map((java) => ({
      path: java.path,
      version: java.version,
      majorVersion: java.majorVersion,
      valid: java.valid,
    })),
  }
}

export function createDiagnoseCommand(cli: CliContext): VirtualCliCommand {
  return { name: 'diagnose', usage: DIAGNOSE_USAGE, description: 'Diagnose the current client installation, local dedicated server, or Java runtime.', help: [
    '`diagnose` and `diagnose client` check the Minecraft jar, libraries, assets, asset index, mod-loader install profile, and required Java.',
    'Client diagnosis returns `healthy: true` when complete; otherwise it returns concrete issues. Run it before `repair`.',
    '`diagnose server` reports the local server installation, processes, EULA, server.properties, and deployed mods.',
    '`diagnose java` reports the selected Java runtime, required major version, compatibility issue, and all runtimes known to the launcher. Run it before `java install`.',
  ], execute: async (argv) => {
    if (argv.length > 1 || (argv[0] !== undefined && argv[0] !== 'client' && argv[0] !== 'server' && argv[0] !== 'java')) {
      return usageError(DIAGNOSE_USAGE, 'diagnose accepts only `client`, `server`, or `java`.')
    }
    if (!cli.ctx.instance.value.path) return { error: 'no instance selected' }
    if (argv[0] === 'server') return cli.ctx.getServerStatus()
    if (argv[0] === 'java') return diagnoseJava(cli)
    return cli.summarizeInstallInstruction(cli.ctx.installInstruction.value)
  } }
}
