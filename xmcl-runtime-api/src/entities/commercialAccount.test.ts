import { describe, expect, it } from 'vitest'
import { CommercialAccountState } from './commercialAccount'

describe('CommercialAccountState', () => {
  it('contains only renderer-safe account and session metadata', () => {
    const state = new CommercialAccountState()
    state.snapshot({
      account: {
        accountId: 'account-1',
        status: 'active',
        createdAt: '2026-07-22T00:00:00.000Z',
      },
      identities: [{
        provider: 'microsoft',
        displayName: 'Player',
        linkedBy: 'launcher_bootstrap',
        linkedAt: '2026-07-22T00:00:00.000Z',
      }],
      session: {
        sessionId: 'session-1',
        accountId: 'account-1',
        scopes: ['account:read'],
        issuedAt: '2026-07-22T00:00:00.000Z',
        expiresAt: '2026-07-22T01:00:00.000Z',
      },
    })

    expect(JSON.stringify(state)).not.toMatch(/accessToken|refreshToken|subject/)
  })

  it('keeps an identity conflict separate from the current account', () => {
    const state = new CommercialAccountState()
    state.identityConflict({ provider: 'modrinth', mergeId: 'merge-1' })

    expect(state.account).toBeUndefined()
    expect(state.conflict).toEqual({ provider: 'modrinth', mergeId: 'merge-1' })
  })

  it('requires a preview before recording an explicit merge task', () => {
    const state = new CommercialAccountState()
    state.mergePrepared({
      mergeId: 'merge-1',
      resources: [{ type: 'backup', count: 2 }],
    })
    expect(state.mergePreview?.resources).toEqual([{ type: 'backup', count: 2 }])

    state.mergeQueued('task-1')
    expect(state.mergePreview).toBeUndefined()
    expect(state.mergeTaskId).toBe('task-1')
  })
})
