import type { AgentContext } from './tools'
import type { Tool } from './loop'

/**
 * Lazy-loaded account tools. Triggered by `load_tools(["account"])`.
 *
 * Lets the agent switch which already-logged-in account is active. It only
 * lists existing accounts and selects one — it never handles passwords, tokens,
 * or performs a fresh login (that must happen through the launcher UI).
 */
export function createAccountTools(ctx: AgentContext): Tool[] {
  return [
    {
      name: 'list_accounts',
      readonly: true,
      description: 'List the accounts already logged into the launcher: id, username, authority (e.g. microsoft / offline), the selected game-profile name, and whether the session is expired. Use an `id` from here with `select_account`.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        const active = ctx.userProfile.value?.id
        return ctx.accounts.value.map((u) => ({
          id: u.id,
          username: u.username,
          authority: u.authority,
          profile: u.profiles?.[u.selectedProfile]?.name,
          expired: u.invalidated || u.expiredAt < Date.now(),
          active: u.id === active,
        }))
      },
    },
    {
      name: 'select_account',
      description: 'Switch the active account to an already-logged-in one by its `id` (from `list_accounts`). Does not log in or handle credentials. The launch tools will then use this account.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Account id from list_accounts' },
        },
        required: ['id'],
      },
      async execute(args) {
        const id = String(args.id ?? '')
        const found = ctx.accounts.value.find((u) => u.id === id)
        if (!found) return { error: `account not found: ${id}` }
        ctx.selectAccount(id)
        return { ok: true, id, username: found.username }
      },
    },
  ]
}
