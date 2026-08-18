import type { XmclTogetherOverview } from '@xmcl/runtime-api'

export function hasActiveXmclSubscription(overview: XmclTogetherOverview) {
  return overview.subscription?.status === 'active'
}