import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const SERVER_USAGE = 'server <install|eula|deploy-mods> ...'

export function createServerCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'server',
    usage: SERVER_USAGE,
    description: 'Install and configure the current instance local dedicated server.',
    help: [
      '`server install` downloads and installs the dedicated server build for the current instance runtime.',
      '`server eula <accept|revoke>` changes EULA acceptance. Only accept after the user explicitly agrees to https://aka.ms/MinecraftEULA.',
      '`server deploy-mods [path ...]` deploys explicit client mod paths; with no paths it deploys all enabled server-compatible mods.',
      'Use `diagnose server` for status, `launch server` / `kill server` for lifecycle, and `vfs_read server/...` for files.',
      'Edit server.properties and admin JSON files with `edit_config`; EULA must use `server eula`.',
    ],
    execute: async (argv) => {
      if (!cli.ctx.instance.value.path) return { error: 'no instance selected' }
      const [action, ...args] = argv
      if (action === 'install') {
        if (args.length) return usageError(SERVER_USAGE, 'server install accepts no arguments.')
        return cli.ctx.installServer()
      }
      if (action === 'eula') {
        if (args.length !== 1 || (args[0] !== 'accept' && args[0] !== 'revoke')) return usageError(SERVER_USAGE, 'server eula expects `accept` or `revoke`.')
        return cli.ctx.setServerEula(args[0] === 'accept')
      }
      if (action === 'deploy-mods') {
        const paths = args.length
          ? args.map((path) => {
              const name = path.replace(/^\.?\/+/, '').replace(/^mods\//, '')
              const mod = cli.ctx.mods.value.find((candidate) => candidate.path === path || candidate.fileName === name || candidate.modId === name)
              return mod?.path ?? path
            })
          : undefined
        return cli.ctx.deployServerMods(paths)
      }
      return usageError(SERVER_USAGE, `Unknown server operation: ${action ?? ''}`)
    },
  }
}
