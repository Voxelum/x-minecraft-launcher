import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { makeAgentContext } from '../testContext'
import type { CliContext } from './context'
import { createAccountCommand } from './account'

function accounts() {
  return ref([
    { id: 'u1', username: 'alice', authority: 'microsoft', selectedProfile: 'p1', profiles: { p1: { name: 'AlicePlays' } }, invalidated: false, expiredAt: Date.now() + 100000 },
    { id: 'u2', username: 'bob', authority: 'offline', selectedProfile: 'p2', profiles: { p2: { name: 'Bob' } }, invalidated: false, expiredAt: 0 },
  ]) as any
}

describe('account CLI', () => {
  test('lists accounts with active and expired state', async () => {
    const command = createAccountCommand({ ctx: makeAgentContext({ accounts: accounts(), userProfile: ref({ id: 'u1' }) as any }) } as CliContext)
    expect(await command.execute(['list'])).toEqual([
      { id: 'u1', username: 'alice', authority: 'microsoft', profile: 'AlicePlays', expired: false, active: true },
      { id: 'u2', username: 'bob', authority: 'offline', profile: 'Bob', expired: true, active: false },
    ])
  })

  test('selects an existing account and rejects unknown ids', async () => {
    const selectAccount = vi.fn()
    const command = createAccountCommand({ ctx: makeAgentContext({ accounts: accounts(), selectAccount }) } as CliContext)
    expect(await command.execute(['select', 'u2'])).toEqual({ ok: true, id: 'u2', username: 'bob' })
    expect(selectAccount).toHaveBeenCalledWith('u2')
    expect(await command.execute(['select', 'ghost'])).toMatchObject({ error: expect.stringContaining('account not found') })
  })
})
