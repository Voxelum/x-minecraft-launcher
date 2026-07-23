import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const NAVIGATE_USAGE = 'navigate <route>'

export function createNavigateCommand(cli: CliContext): VirtualCliCommand {
  return { name: 'navigate', usage: NAVIGATE_USAGE, description: 'Navigate to a known launcher route.', help: [
    `Known routes: ${cli.knownRoutes.join(', ')}`,
  ], execute: async (argv) => {
    if (argv.length !== 1) return usageError(NAVIGATE_USAGE, 'navigate expects exactly one route.')
    const path = argv[0]
    if (!cli.knownRoutes.includes(path)) return { error: `unknown route: ${path}\nUsage: ${NAVIGATE_USAGE}\nKnown routes: ${cli.knownRoutes.join(', ')}` }
    await cli.ctx.router.push(path)
    return { ok: true, path }
  } }
}
