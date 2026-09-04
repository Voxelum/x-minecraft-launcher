import { ROOT_CONTEXT, SpanKind } from '@opentelemetry/api'
import { SamplingDecision } from '@opentelemetry/sdk-trace-base'
import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_TRACE_SAMPLE_RATE,
  isDeterministicallySampled,
  USER_ACTION_TRACE_SAMPLE_RATE,
  XmclRootTraceSampler,
} from './telemetry_sampling'

describe('telemetry sampling', () => {
  it('makes stable decisions for the same key', () => {
    const first = isDeterministicallySampled('stable-key', 0.1)
    expect(isDeterministicallySampled('stable-key', 0.1)).toBe(first)
    expect(isDeterministicallySampled('stable-key', 0)).toBe(false)
    expect(isDeterministicallySampled('stable-key', 1)).toBe(true)
  })

  it('samples user actions at 25% and background roots at 5%', () => {
    const sampler = new XmclRootTraceSampler()
    const decisions = (spanName: string) =>
      Array.from({ length: 1_000 }, (_, index) => {
        const traceId = index.toString(16).padStart(32, '0')
        return sampler.shouldSample(
          ROOT_CONTEXT,
          traceId,
          spanName,
          SpanKind.INTERNAL,
          {},
          [],
        ).decision
      }).filter((decision) => decision === SamplingDecision.RECORD_AND_SAMPLED).length

    expect(decisions('user_action.minecraft.launch')).toBeGreaterThanOrEqual(200)
    expect(decisions('user_action.minecraft.launch')).toBeLessThanOrEqual(300)
    expect(decisions('task.execute')).toBeGreaterThanOrEqual(25)
    expect(decisions('task.execute')).toBeLessThanOrEqual(75)
    expect(USER_ACTION_TRACE_SAMPLE_RATE).toBe(0.25)
    expect(BACKGROUND_TRACE_SAMPLE_RATE).toBe(0.05)
  })
})
