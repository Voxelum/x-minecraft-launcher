import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface RendererScenario {
  id: string
  input: {
    idempotencyKeys?: string[]
    error?: string
  }
  view: {
    state: string
    result?: string
    messageKey?: string
    action: string
    confirmedBalancePreserved?: boolean
  }
  invariants: Record<string, boolean | number>
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/xmcl-page-renderer-states.json'), 'utf8'),
) as {
  schema: string
  notice: string
  scenarios: RendererScenario[]
}

const byId = (id: string) => {
  const scenario = fixture.scenarios.find((candidate) => candidate.id === id)
  if (!scenario) throw new Error(`Missing renderer fixture: ${id}`)
  return scenario
}

describe('M8 xmcl-page renderer proposal fixtures', () => {
  it('covers all required renderer states without provider detail exposure', () => {
    expect(fixture.schema).toBe('m8.xmcl-page.renderer-state.proposal.v1')
    expect(fixture.notice).toContain('Module-local mock')
    expect(fixture.scenarios.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'api-error',
      'authentication-required',
      'permission-denied',
      'idempotent-transport-retry',
      'provider-failure',
      'usage-event-retry',
      'duplicate-usage-event',
      'out-of-order-usage-events',
      'insufficient-balance',
      'authorization-conflict',
      'balance-refresh-conflict',
    ]))

    for (const scenario of fixture.scenarios) {
      expect(scenario.invariants.providerDetailsVisible, scenario.id).toBe(false)
    }
  })

  it('reuses one intent key and never presents a retry as another charge', () => {
    const retry = byId('idempotent-transport-retry')
    expect(new Set(retry.input.idempotencyKeys)).toHaveLength(1)
    expect(retry.invariants.providerCalls).toBe(1)
    expect(retry.invariants.settlementCount).toBe(1)
    expect(retry.invariants.additionalCharge).toBe(false)
  })

  it('keeps provider failures sanitized and usage-free', () => {
    const failure = byId('provider-failure')
    expect(failure.input.error).toBe('ai_provider_unavailable')
    expect(failure.view.messageKey).toBe('ai.error.providerUnavailable')
    expect(failure.invariants.rawProviderBodyVisible).toBe(false)
    expect(failure.invariants.usageEvents).toBe(0)
  })

  it('preserves results through event retry and deduplicates settlement', () => {
    const retry = byId('usage-event-retry')
    const duplicate = byId('duplicate-usage-event')
    const outOfOrder = byId('out-of-order-usage-events')

    expect(retry.view.state).toBe('result_reconciling')
    expect(retry.invariants.resultPreserved).toBe(true)
    expect(retry.invariants.settlementCount).toBe(1)
    expect(duplicate.invariants.settlementCount).toBe(1)
    expect(duplicate.invariants.additionalCharge).toBe(false)
    expect(outOfOrder.invariants.additionalChargeOnReplay).toBe(false)
  })

  it('keeps auth, balance, and conflict failures actionable and non-authoritative', () => {
    expect(byId('authentication-required').view.action).toBe('sign_in')
    expect(byId('permission-denied').view.action).toBe('none')
    expect(byId('insufficient-balance').view.action).toBe('manage_balance')
    expect(byId('insufficient-balance').invariants.providerCalled).toBe(false)
    expect(byId('authorization-conflict').view.action).toBe('retry_new_intent')

    const balanceConflict = byId('balance-refresh-conflict')
    expect(balanceConflict.view.confirmedBalancePreserved).toBe(true)
    expect(balanceConflict.invariants.browserCalculatedBalanceVisible).toBe(false)
  })
})
