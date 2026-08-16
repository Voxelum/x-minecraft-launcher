import type { ConnectionState, MultiplayerRoomMember } from '@xmcl/runtime-api'

export const TOGETHER_CONNECTION_WARNING_DELAY_MS = 15_000

export interface RoomPeerConnectionSnapshot {
  member: MultiplayerRoomMember
  connectionState?: ConnectionState
}

export type TogetherTrialStatus = 'available' | 'active' | 'expired' | 'unavailable'
export type TogetherSubscriptionStatus = 'active' | 'payment_due' | 'cancelled'

export function shouldRecommendTogether(options: {
  problematicNat: boolean
  isMaster: boolean
  longConnectionProblem: boolean
  trialStatus?: TogetherTrialStatus
  subscriptionStatus?: TogetherSubscriptionStatus
}) {
  if (!options.trialStatus) return false
  const hasAccess =
    options.trialStatus === 'active' || options.subscriptionStatus === 'active'
  return (
    !hasAccess &&
    (options.problematicNat || (options.isMaster && options.longConnectionProblem))
  )
}

export function getTogetherRecommendationAction(
  trialStatus?: TogetherTrialStatus,
): 'try' | 'buy' {
  return trialStatus === 'available' ? 'try' : 'buy'
}

export function updateConnectionProblemSince(
  problemSince: Map<string, number>,
  peers: RoomPeerConnectionSnapshot[],
  now: number,
) {
  const currentPeerIds = new Set(peers.map(({ member }) => member.peerId))
  for (const peerId of problemSince.keys()) {
    if (!currentPeerIds.has(peerId)) problemSince.delete(peerId)
  }

  for (const { member, connectionState } of peers) {
    const unresolved = member.status !== 'connected' || connectionState !== 'connected'
    if (!unresolved) {
      problemSince.delete(member.peerId)
    } else if (!problemSince.has(member.peerId)) {
      const joinedAt = Number.isFinite(member.joinedAt) ? member.joinedAt : now
      problemSince.set(
        member.peerId,
        member.status === 'negotiating' ? Math.min(joinedAt, now) : now,
      )
    }
  }
}

export function hasLongConnectionProblem(
  problemSince: ReadonlyMap<string, number>,
  now: number,
  delayMs = TOGETHER_CONNECTION_WARNING_DELAY_MS,
) {
  return [...problemSince.values()].some((startedAt) => now - startedAt >= delayMs)
}