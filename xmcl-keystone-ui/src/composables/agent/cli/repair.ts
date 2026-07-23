import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const REPAIR_USAGE = 'repair'

export function createRepairCommand(cli: CliContext): VirtualCliCommand {
  return { name: 'repair', usage: REPAIR_USAGE, description: 'Install missing or corrupted instance files and required Java.', help: [
    'Safe and idempotent. Use after `diagnose` for incomplete or corrupted installations.',
    'Returns the installation diagnosis before and after repair.',
  ], execute: async (argv) => {
    if (argv.length) return usageError(REPAIR_USAGE, 'repair does not accept arguments.')
    if (!cli.ctx.instance.value.path) return { error: 'no instance selected' }
    const before = cli.summarizeInstallInstruction(cli.ctx.installInstruction.value)
    if (before.available && before.healthy) return { ok: true, alreadyHealthy: true, note: 'Nothing to install — the instance is already complete.' }
    await cli.ctx.fixInstanceInstall()
    return { ok: true, before, after: cli.summarizeInstallInstruction(cli.ctx.installInstruction.value) }
  } }
}
