import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const LAUNCH_USAGE = 'launch [client|server] [--nogui]'

export function createLaunchCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'launch',
    usage: LAUNCH_USAGE,
    description: 'Launch the current instance as a client or local server.',
    help: [
      'Defaults to `client`. The command returns after the launch handshake completes.',
      '`--nogui` is intended for the local dedicated server.',
    ],
    execute: async (argv) => {
      const positional = argv.filter((arg) => !arg.startsWith('-'))
      const flags = argv.filter((arg) => arg.startsWith('-'))
      const validSide = positional.length === 0 || (positional.length === 1 && (positional[0] === 'client' || positional[0] === 'server'))
      const validFlags = flags.length <= 1 && flags.every((flag) => flag === '--nogui')
      if (!validSide || !validFlags) return usageError(LAUNCH_USAGE, 'Invalid launch arguments.')
      const side = (positional[0] ?? 'client') as 'client' | 'server'
      return cli.ctx.launch(side, { nogui: argv.includes('--nogui') })
    },
  }
}
