import { describe, expect, it } from 'vitest'
import { hasActiveXmclSubscription } from './access'

function overviewWithSubscription(status: 'active' | 'payment_due' | 'cancelled' | undefined) {
  return {
    subscription: status ? { status } : null,
  } as Parameters<typeof hasActiveXmclSubscription>[0]
}

describe('hasActiveXmclSubscription', () => {
  it('allows an active XMCL subscription', () => {
    expect(hasActiveXmclSubscription(overviewWithSubscription('active'))).toBe(true)
  })

  it.each([undefined, 'payment_due', 'cancelled'] as const)(
    'rejects a non-active subscription: %s',
    (status) => {
      expect(hasActiveXmclSubscription(overviewWithSubscription(status))).toBe(false)
    },
  )
})