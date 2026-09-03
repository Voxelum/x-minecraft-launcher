import { SamplingDecision, type Sampler, type SamplingResult } from '@opentelemetry/sdk-trace-base'
import type { Attributes, Context, Link, SpanKind } from '@opentelemetry/api'
import { createHash } from 'crypto'

export const USER_ACTION_TRACE_SAMPLE_RATE = 0.25
export const BACKGROUND_TRACE_SAMPLE_RATE = 0.05
export const DOWNLOAD_SESSION_SAMPLE_RATE = 0.1
export const AGENT_SUCCESS_SAMPLE_RATE = 0.1
export const RESOURCE_METADATA_SAMPLE_RATE = 0.05

export function isDeterministicallySampled(key: string, rate: number) {
  if (rate <= 0) return false
  if (rate >= 1) return true
  const value = Number.parseInt(createHash('sha256').update(key).digest('hex').slice(0, 13), 16)
  return value / 0x10000000000000 < rate
}

export class XmclRootTraceSampler implements Sampler {
  shouldSample(
    _context: Context,
    traceId: string,
    spanName: string,
    _spanKind: SpanKind,
    _attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    const rate = spanName.startsWith('user_action.')
      ? USER_ACTION_TRACE_SAMPLE_RATE
      : BACKGROUND_TRACE_SAMPLE_RATE
    return {
      decision: isDeterministicallySampled(traceId, rate)
        ? SamplingDecision.RECORD_AND_SAMPLED
        : SamplingDecision.NOT_RECORD,
      attributes: {
        'xmcl.sampling.rate': rate,
      },
    }
  }

  toString() {
    return `XmclRootTraceSampler{userAction=${USER_ACTION_TRACE_SAMPLE_RATE},background=${BACKGROUND_TRACE_SAMPLE_RATE}}`
  }
}
