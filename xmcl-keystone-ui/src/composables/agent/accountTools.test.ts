import { describe, test, expect, vi } from 'vitest'
import { ref } from 'vue'
import { createAccountTools } from './accountTools'
import { makeAgentContext, getTool, noopSignal } from './testContext'

function makeAccounts() {
  return ref([
    { id: 'u1', username: 'alice', authority: 'microsoft', selectedProfile: 'p1', profiles: { p1: { name: 'AlicePlays' } }, invalidated: false, expiredAt: Date.now() + 100000 },
    { id: 'u2', username: 'bob', authority: 'offline', selectedProfile: 'p2', profiles: { p2: { name: 'Bob' } }, invalidated: false, expiredAt: 0 },
  ]) as any
}

describe('createAccountTools', () => {
  test('exposes the expected tool set', () => {
    const tools = createAccountTools(makeAgentContext())
    expect(tools.map((t) => t.name).sort()).toEqual(['list_accounts', 'select_account'])
  })

  test('list_accounts marks the active account and expired sessions', async () => {
    const ctx = makeAgentContext({
      accounts: makeAccounts(),
      userProfile: ref({ id: 'u1' }) as any,
    })
    const res = await getTool(tools(ctx), 'list_accounts').execute({}, noopSignal) as any[]
    expect(res).toEqual([
      { id: 'u1', username: 'alice', authority: 'microsoft', profile: 'AlicePlays', expired: false, active: true },
      { id: 'u2', username: 'bob', authority: 'offline', profile: 'Bob', expired: true, active: false },
    ])
  })

  test('select_account switches to an existing account', async () => {
    const selectAccount = vi.fn()
    const ctx = makeAgentContext({ accounts: makeAccounts(), selectAccount })
    const res = await getTool(tools(ctx), 'select_account').execute({ id: 'u2' }, noopSignal)
    expect(selectAccount).toHaveBeenCalledWith('u2')
    expect(res).toEqual({ ok: true, id: 'u2', username: 'bob' })
  })

  test('select_account rejects an unknown id without switching', async () => {
    const selectAccount = vi.fn()
    const ctx = makeAgentContext({ accounts: makeAccounts(), selectAccount })
    const res = await getTool(tools(ctx), 'select_account').execute({ id: 'ghost' }, noopSignal)
    expect(res).toMatchObject({ error: expect.stringContaining('account not found') })
    expect(selectAccount).not.toHaveBeenCalled()
  })
})

function tools(ctx: ReturnType<typeof makeAgentContext>) {
  return createAccountTools(ctx)
}
