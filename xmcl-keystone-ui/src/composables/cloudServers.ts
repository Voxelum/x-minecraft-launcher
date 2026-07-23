import type { CloudServer, CloudServerLog, CloudServerService } from '@xmcl/runtime-api'
import { CloudServerApiErrorSchema, CloudServerServiceKey } from '@xmcl/runtime-api'
import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useService } from './service'

export type CloudServerIssue = 'insufficient_balance' | 'status_conflict' | 'session_required' | 'not_found' | 'unknown'

export function mergeCloudServerSnapshot(
  current: CloudServer | undefined,
  incoming: CloudServer,
  expectedServerId: string,
): CloudServer | undefined {
  if (incoming.serverId !== expectedServerId) return current
  if (current?.serverId === incoming.serverId && incoming.statusVersion <= current.statusVersion) return current
  return incoming
}

export function mergeCloudServerLogs(
  current: readonly CloudServerLog[],
  incoming: readonly CloudServerLog[],
  expectedServerId: string,
): CloudServerLog[] {
  const byId = new Map(current.filter(log => log.serverId === expectedServerId).map(log => [log.logId, log]))
  for (const log of incoming) {
    if (log.serverId === expectedServerId && !byId.has(log.logId)) {
      byId.set(log.logId, log)
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.sequence - b.sequence ||
    a.occurredAt.localeCompare(b.occurredAt) ||
    a.logId.localeCompare(b.logId))
}

export function mapCloudServerIssue(error: unknown): CloudServerIssue | undefined {
  if (error === undefined || error === null) return undefined
  const parsed = CloudServerApiErrorSchema.safeParse(error)
  const errorCode = parsed.success
    ? parsed.data.error
    : typeof error === 'object' && error && 'errorCode' in error && typeof error.errorCode === 'string'
      ? error.errorCode
      : undefined
  switch (errorCode) {
    case 'usage_authorization_rejected':
      return 'insufficient_balance'
    case 'server_state_conflict':
      return 'status_conflict'
    case 'session_required':
      return 'session_required'
    case 'server_not_found':
      return 'not_found'
    default:
      return 'unknown'
  }
}

export function useCloudServer(
  serverId: Ref<string>,
  service: Pick<CloudServerService, 'getServer' | 'getServerLogs'> = useService(CloudServerServiceKey),
) {
  const server = shallowRef<CloudServer>()
  const cloudServerLogs = shallowRef<CloudServerLog[]>([])
  const nextLogCursor = ref<string>()
  const refreshingRuntime = ref(false)
  const refreshingLogs = ref(false)
  const runtimeIssue = ref<CloudServerIssue>()
  const logsIssue = ref<CloudServerIssue>()

  watch(serverId, () => {
    server.value = undefined
    cloudServerLogs.value = []
    nextLogCursor.value = undefined
    runtimeIssue.value = undefined
    logsIssue.value = undefined
  })

  async function refreshRuntime() {
    const requestedServerId = serverId.value
    refreshingRuntime.value = true
    runtimeIssue.value = undefined
    try {
      const incoming = await service.getServer(requestedServerId)
      if (serverId.value === requestedServerId) {
        server.value = mergeCloudServerSnapshot(server.value, incoming, requestedServerId)
      }
    } catch (error) {
      if (serverId.value === requestedServerId) runtimeIssue.value = mapCloudServerIssue(error)
      throw error
    } finally {
      if (serverId.value === requestedServerId) refreshingRuntime.value = false
    }
  }

  async function refreshLogs(reset = true) {
    const requestedServerId = serverId.value
    const cursor = reset ? undefined : nextLogCursor.value
    refreshingLogs.value = true
    logsIssue.value = undefined
    try {
      const page = await service.getServerLogs({ serverId: requestedServerId, cursor })
      if (serverId.value === requestedServerId) {
        cloudServerLogs.value = mergeCloudServerLogs(
          reset ? [] : cloudServerLogs.value,
          page.items,
          requestedServerId,
        )
        nextLogCursor.value = page.nextCursor
      }
    } catch (error) {
      if (serverId.value === requestedServerId) logsIssue.value = mapCloudServerIssue(error)
      throw error
    } finally {
      if (serverId.value === requestedServerId) refreshingLogs.value = false
    }
  }

  return {
    server,
    runtimeStatus: computed(() => server.value?.status),
    connectionAddress: computed(() => server.value?.address),
    cloudServerLogs,
    nextLogCursor,
    refreshingRuntime,
    refreshingLogs,
    runtimeIssue,
    logsIssue,
    refreshRuntime,
    refreshLogs,
    loadMoreLogs: () => refreshLogs(false),
  }
}
