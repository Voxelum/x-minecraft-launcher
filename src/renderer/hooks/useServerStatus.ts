import { computed, inject, InjectionKey, provide, reactive, Ref, ref, set, watch } from '@vue/composition-api'
import { useService } from './useService'
import { PINGING_STATUS, ServerStatus, UNKNOWN_STATUS } from '/@shared/entities/serverStatus'
import { InstanceServiceKey } from '/@shared/services/InstanceService'
import { ServerStatusServiceKey } from '/@shared/services/ServerStatusService'
import { isNonnull } from '/@shared/util/assert'
import mapping from '/@shared/util/protocolToMinecraft'

export function useProtocolAcceptVersion(protocol: Ref<number>) {
  return computed(() => `[${mapping[protocol.value].join(', ')}]`)
}

export function useSeverStatusAcceptVersion(status: Ref<ServerStatus>) {
  return computed(() => `[${(mapping[status.value.version.protocol] ?? []).join(', ')}]`)
}

export const ServerStatusCache: InjectionKey<Record<string, ServerStatus>> = Symbol('ServerStatusCache')

export function provideServerStatusCache() {
  const cache = reactive({})
  // WARN: potential memory leak
  provide(ServerStatusCache, cache)
}

export function useInstanceServerStatus(instancePath?: string) {
  const { state } = useService(InstanceServiceKey)
  const instance = computed(() => state.all[instancePath ?? state.path])
  const serverRef = computed(() => instance.value?.server ?? { host: '' })
  return useServer(serverRef, ref(25565))
}

export function useInstancesServerStatus() {
  const { state } = useService(InstanceServiceKey)
  const cache = inject(ServerStatusCache, {})
  const { pingServer } = useService(ServerStatusServiceKey)
  const pinging = ref(false)
  async function refreshOne(server: { host: string; port?: number }) {
    const id = `${server.host}:${server.port ?? 25565}`
    set(cache, id, PINGING_STATUS)
    cache[id] = await pingServer({
      host: server.host,
      port: server.port,
    })
  }
  function refresh() {
    pinging.value = true
    return Promise.all(state.instances.map(i => i.server).filter(isNonnull).map(refreshOne)).finally(() => { pinging.value = false })
  }
  return {
    pinging,
    refresh,
  }
}

export function useServer(serverRef: Ref<{ host: string; port?: number }>, protocol: Ref<number | undefined>) {
  const { pingServer } = useService(ServerStatusServiceKey)
  const cache = inject(ServerStatusCache, {})
  const serverId = computed(() => `${serverRef.value.host}:${serverRef.value.port ?? 25565}`)
  if (!cache[serverId.value]) {
    set(cache, serverId.value, UNKNOWN_STATUS)
  }
  watch(serverId, () => {
    if (!cache[serverId.value]) {
      set(cache, serverId.value, UNKNOWN_STATUS)
    }
  })
  const status = computed<ServerStatus>({
    get() { return cache[serverId.value] },
    set(v) { set(cache, serverId.value, v) },
  })
  const pinging = ref(false)
  /**
     * Refresh the server status. If the server is empty, it will do nothing.
     */
  async function refresh() {
    const server = serverRef.value
    if (!server.host) return
    pinging.value = true
    status.value = PINGING_STATUS
    status.value = await pingServer({
      host: server.host,
      port: server.port,
      protocol: protocol.value,
    }).finally(() => {
      pinging.value = false
    })
    /* .catch((e) => {
            if (e.code === 'ENOTFOUND') {
                status.value.description = $t('profile.server.status.nohost');
            } else if (e.code === 'ETIMEOUT') {
                status.value.description = $t('profile.server.status.timeout');
            } else if (e.code === 'ECONNREFUSED') {
                status.value.description = $t('profile.server.status.refuse');
            } else {
                status.value.description = '';
            }
        }); */
  }

  watch(serverRef, () => {
    reset()
  })

  function reset() {
    status.value = UNKNOWN_STATUS
  }

  const acceptingVersion = useSeverStatusAcceptVersion(status)
  return {
    acceptingVersion,
    status,
    pinging,
    refresh,
    reset,
  }
}
