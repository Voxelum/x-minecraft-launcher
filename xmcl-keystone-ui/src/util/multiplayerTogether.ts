import { getInstanceManifestFingerprintSource, type InstanceManifest, type RuntimeVersions } from '@xmcl/instance'
import type { ConnectionState, MultiplayerRoomMember } from '@xmcl/runtime-api'

export const TOGETHER_CONNECTION_WARNING_DELAY_MS = 15_000

export interface RoomPeerConnectionSnapshot {
  member: MultiplayerRoomMember
  connectionState?: ConnectionState
}

export interface RoomPeerItem<Connection> {
  key: string
  member?: MultiplayerRoomMember
  connection?: Connection
}

export type TogetherTrialStatus = 'available' | 'active' | 'expired' | 'unavailable'
export type TogetherSubscriptionStatus = 'active' | 'payment_due' | 'cancelled'

export function isProblematicNatType(natType: string) {
  return (
    natType === 'Symmetric NAT' ||
    natType === 'Symmetric UDP Firewall' ||
    natType === 'Blocked'
  )
}

export function mergeRoomPeerConnections<Connection extends { id: string; remoteId?: string }>(
  members: MultiplayerRoomMember[],
  connections: Connection[],
): RoomPeerItem<Connection>[] {
  const roomPeerIds = new Set(members.map((member) => member.peerId))
  const connectionsByRemoteId = new Map(
    connections
      .filter((connection) => connection.remoteId)
      .map((connection) => [connection.remoteId, connection]),
  )
  return [
    ...members.map((member) => ({
      key: member.peerId,
      member,
      connection: connectionsByRemoteId.get(member.peerId),
    })),
    ...connections
      .filter((connection) => !connection.remoteId || !roomPeerIds.has(connection.remoteId))
      .map((connection) => ({
        key: connection.remoteId || connection.id,
        connection,
      })),
  ]
}

export function getVisibleRoomPeerMembers(
  members: MultiplayerRoomMember[],
  selfPeerId: string,
  masterPeerId: string,
) {
  return members.filter((member) =>
    member.peerId !== selfPeerId &&
    (selfPeerId === masterPeerId || member.peerId === masterPeerId),
  )
}

const runtimeKeys = [
  'minecraft',
  'forge',
  'neoForged',
  'fabricLoader',
  'quiltLoader',
  'optifine',
  'labyMod',
] as const

export function isRuntimeMatched(
  local: Partial<RuntimeVersions>,
  remote: Partial<RuntimeVersions>,
) {
  return runtimeKeys.every((key) => (local[key] ?? '') === (remote[key] ?? ''))
}

export function isInstanceManifestMatched(
  local: Pick<InstanceManifest, 'runtime' | 'files' | 'fingerprint'>,
  remote: Pick<InstanceManifest, 'runtime' | 'files' | 'fingerprint'>,
) {
  if (local.fingerprint && remote.fingerprint) {
    return local.fingerprint === remote.fingerprint
  }
  return getInstanceManifestFingerprintSource(local) === getInstanceManifestFingerprintSource(remote)
}

export function getInstanceMatchCandidates<Instance extends {
  path: string
  edition?: string
  runtime: Partial<RuntimeVersions>
  upstream?: {
    type: string
    id?: string | number
    accountId?: string
    fingerprint?: string
  }
}>(
  instances: Instance[],
  manifest: { runtime: Partial<RuntimeVersions>; fingerprint?: string },
  accountId?: string,
) {
  const score = (instance: Instance) => {
    if (instance.upstream?.type !== 'peer') return 0
    if (manifest.fingerprint && instance.upstream.fingerprint === manifest.fingerprint) return 2
    const upstreamAccountId = instance.upstream.accountId || instance.upstream.id
    return accountId && upstreamAccountId === accountId ? 1 : 0
  }
  return instances
    .filter((instance) =>
      instance.edition !== 'bedrock' && isRuntimeMatched(instance.runtime, manifest.runtime),
    )
    .map((instance, index) => ({ instance, index, score: score(instance) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ instance }) => instance)
}

export async function findInstanceManifestMatch<Instance extends {
  path: string
  edition?: string
  runtime: Partial<RuntimeVersions>
  upstream?: {
    type: string
    id?: string | number
    accountId?: string
    fingerprint?: string
  }
}>(
  instances: Instance[],
  manifest: InstanceManifest,
  accountId: string | undefined,
  getManifest: (instance: Instance) => Promise<InstanceManifest>,
) {
  for (const candidate of getInstanceMatchCandidates(instances, manifest, accountId)) {
    if (isInstanceManifestMatched(await getManifest(candidate), manifest)) return candidate
  }
  return undefined
}

export function getPeerInstanceUpdateCandidate<Instance extends {
  path: string
  edition?: string
  runtime: Partial<RuntimeVersions>
  upstream?: {
    type: string
    id?: string | number
    accountId?: string
    fingerprint?: string
  }
}>(
  instances: Instance[],
  manifest: { runtime: Partial<RuntimeVersions>; fingerprint?: string },
  accountId?: string,
) {
  const candidates = getInstanceMatchCandidates(instances, manifest, accountId)
    .filter((instance) => instance.upstream?.type === 'peer')
  const fingerprintMatches = manifest.fingerprint
    ? candidates.filter((instance) => instance.upstream?.fingerprint === manifest.fingerprint)
    : []
  if (fingerprintMatches.length === 1) return fingerprintMatches[0]
  if (fingerprintMatches.length > 1 || !accountId) return undefined
  const accountMatches = candidates.filter((instance) =>
    (instance.upstream?.accountId || instance.upstream?.id) === accountId,
  )
  return accountMatches.length === 1 ? accountMatches[0] : undefined
}

export function resolveLanSharingInstance(
  processes: Array<{
    side?: 'client' | 'server'
    options: { gameDirectory: string }
  }>,
  selectedInstancePath: string,
) {
  const runningClientInstances = Array.from(new Set(
    processes
      .filter((process) => process.side !== 'server')
      .map((process) => process.options.gameDirectory)
      .filter(Boolean),
  ))
  if (runningClientInstances.length === 1) return runningClientInstances[0]
  if (selectedInstancePath && runningClientInstances.includes(selectedInstancePath)) {
    return selectedInstancePath
  }
  return undefined
}

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

export function isWaffoCheckoutUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'checkout.waffo.ai' || url.hostname === 'pancake.waffo.ai')
    )
  } catch {
    return false
  }
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