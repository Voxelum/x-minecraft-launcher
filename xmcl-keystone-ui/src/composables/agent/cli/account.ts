import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const ACCOUNT_USAGE = 'account <list|select> [id]'

export function createAccountCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'account',
    usage: ACCOUNT_USAGE,
    description: 'List already-logged-in accounts or switch the active account.',
    help: [
      '`account list` lists existing launcher accounts, profiles, session expiry, and the active account.',
      '`account select <id>` switches to an existing account. It never logs in or handles credentials.',
      'Use an exact id returned by `account list`.',
    ],
    execute: async (argv) => {
      if (argv[0] === 'list') {
        if (argv.length !== 1) return usageError(ACCOUNT_USAGE, 'account list accepts no arguments.')
        const active = cli.ctx.userProfile.value?.id
        return cli.ctx.accounts.value.map((account) => ({
          id: account.id,
          username: account.username,
          authority: account.authority,
          profile: account.profiles?.[account.selectedProfile]?.name,
          expired: account.invalidated || account.expiredAt < Date.now(),
          active: account.id === active,
        }))
      }
      if (argv[0] === 'select') {
        if (argv.length !== 2) return usageError(ACCOUNT_USAGE, 'account select requires one account id.')
        const id = argv[1]
        const account = cli.ctx.accounts.value.find((candidate) => candidate.id === id)
        if (!account) return { error: `account not found: ${id}` }
        cli.ctx.selectAccount(id)
        return { ok: true, id, username: account.username }
      }
      return usageError(ACCOUNT_USAGE, `Unknown account operation: ${argv[0] ?? ''}`)
    },
  }
}
