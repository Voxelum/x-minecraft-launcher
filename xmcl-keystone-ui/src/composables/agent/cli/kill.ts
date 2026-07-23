import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const KILL_USAGE = 'kill [client|server] [--force]'

export function createKillCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'kill',
    usage: KILL_USAGE,
    description: 'Stop the current instance client or local server process.',
    help: [
      'Defaults to `client`. Killing a running process is destructive; confirm with the user first.',
      '`--force` force-terminates the process tree.',
    ],
    execute: async (argv) => {
      const positional = argv.filter((arg) => !arg.startsWith('-'))
      const flags = argv.filter((arg) => arg.startsWith('-'))
      const validSide = positional.length === 0 || (positional.length === 1 && (positional[0] === 'client' || positional[0] === 'server'))
      const validFlags = flags.length <= 1 && flags.every((flag) => flag === '--force')
      if (!validSide || !validFlags) return usageError(KILL_USAGE, 'Invalid kill arguments.')
      const side = (positional[0] ?? 'client') as 'client' | 'server'
      await cli.ctx.killGame(side, argv.includes('--force'))
      return { ok: true, side, force: argv.includes('--force') }
    },
  }
}
