import { describe, expect, it } from 'vitest'
import { getCurrentInstanceState } from './instanceLaunchState'

describe(getCurrentInstanceState.name, () => {
  it('returns state belonging to the selected instance', () => {
    const state = { instance: 'instance-a', pendingFileCount: 1 }

    expect(getCurrentInstanceState(state, 'instance-a')).toBe(state)
  })

  it('rejects state left over from another instance', () => {
    const state = { instance: 'instance-a', pendingFileCount: 1 }

    expect(getCurrentInstanceState(state, 'instance-b')).toBeUndefined()
    expect(getCurrentInstanceState(undefined, 'instance-b')).toBeUndefined()
  })
})