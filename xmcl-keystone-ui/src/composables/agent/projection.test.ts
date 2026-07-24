import type { AgentRunEvent } from '@xmcl/runtime-api'
import { describe, expect, test } from 'vitest'
import { selectPendingRunEvents } from './projection'

describe('agent run projection', () => {
  test('orders buffered events and drops snapshot duplicates or other runs', () => {
    const event = (runId: string, seq: number): AgentRunEvent => ({
      runId,
      seq,
      type: 'state',
      state: 'running',
    })
    expect(selectPendingRunEvents([
      event('run', 4),
      event('other', 5),
      event('run', 2),
      event('run', 3),
    ], 'run', 2).map(value => value.seq)).toEqual([3, 4])
  })
})
