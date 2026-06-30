import { PingServerOptions, ServerStatus, ServerStatusServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref, computed, ref, watch } from 'vue'

import { useService } from '@/composables'
import { useLocalStorage } from '@vueuse/core'
import { injection } from '@/util/inject'
import { kInstances } from './instances'
import { Instance } from '@xmcl/instance'
import { useMinecraftProtocol } from './protocol'

export const kServerStatusCache: InjectionKey<Ref<Record<string, ServerStatus>>> = Symbol('ServerStatusCache')

export function useInstanceServerStatus(instance: Ref<Instance | undefined>) {
  const protocol = useMinecraftProtocol(computed(() => instance.value?.runtime.minecraft))
  return useServerStatus(computed(() => instance.value?.server ?? { host: '' }), protocol)
}

export function useServerStatusCache() {
  return useLocalStorage<Record<string, ServerStatus>>('serverStatusCache', {}, { deep: false, writeDefaults: false })
}

/**
 * Default freshness window for a cached server status. A ping younger than
 * this is reused instead of re-querying the server.
 */
export const SERVER_STATUS_TTL = 5 * 60 * 1000

/**
 * Per-`host:port` timestamp (ms epoch) of the last successful ping, shared
 * across every `useServerStatus` consumer so the same server is not pinged
 * twice within {@link SERVER_STATUS_TTL}. Persisted to `localStorage` so the
 * dedup also survives a window reload. Kept separate from the status cache to
 * avoid changing the serialized `ServerStatus` shape.
 */
const pingedAt = (() => {
  let map: Record<string, number> | undefined
  const KEY = 'serverStatusCacheTime'
  const load = () => {
    if (map) return map
    try {
      map = JSON.parse(localStorage.getItem(KEY) || '{}')
    } catch {
      map = {}
    }
    return map!
  }
  return {
    get(id: string) { return load()[id] ?? 0 },
    set(id: string, time: number) {
      const m = load()
      m[id] = time
      localStorage.setItem(KEY, JSON.stringify(m))
    },
  }
})()


function useUnknown() {
  const { t } = useI18n()
  return computed(() => {
    return {
      version: {
        name: t('server.unknown'),
        protocol: -1 },
      players: {
        max: -1,
        online: -1 },
      description: t('server.unknownDescription'),
      favicon: '',
      ping: 0 }
  })
}

function usePingServer() {
  const { pingServer } = useService(ServerStatusServiceKey)
  const { te, t } = useI18n()
  const tStatus = computed(() => ({
    'serverStatus.nohost': t('serverStatus.nohost'),
    'serverStatus.refuse': t('serverStatus.refuse'),
    'serverStatus.timeout': t('serverStatus.timeout'),
    'serverStatus.ping': t('serverStatus.ping') } as Record<string, string>))
  return async function (options: PingServerOptions) {
    const result = await pingServer(options)
    result.description = typeof result.description !== 'string' ? result.description : (tStatus.value[result.description] ?? (te(result.description) ? t(result.description) : result.description))
    result.version.name = typeof result.version.name !== 'string' ? result.version.name : (tStatus.value[result.version.name] ?? (te(result.version.name) ? t(result.version.name) : result.version.name))
    return result
  }
}

export function useInstancesServerStatus() {
  const { instances } = injection(kInstances)
  const cache = injection(kServerStatusCache)
  const pingServer = usePingServer()
  const pinging = ref(false)
  async function refreshOne(server: { host: string; port?: number }) {
    const id = `${server.host}:${server.port ?? 25565}`
    // Stale-while-revalidate: keep the cached status (and favicon) on screen
    // while the ping is in flight, and preserve the old favicon if the new
    // ping comes back without one.
    const result = await pingServer({
      host: server.host,
      port: server.port })
    const prev = cache.value[id]
    if (prev?.favicon && !result.favicon) {
      result.favicon = prev.favicon
    }
    cache.value[id] = result
    pingedAt.set(id, Date.now())
    // Workaround to force save as reactivity is broken
    localStorage.setItem('serverStatusCache', JSON.stringify(cache.value))
  }
  function refresh() {
    pinging.value = true
    return Promise.all(instances.value.map(i => i.server).filter(<T>(v: T | null | undefined): v is T => !!v).map(refreshOne)).finally(() => { pinging.value = false })
  }
  return {
    pinging,
    refresh }
}

export const kServerStatus: InjectionKey<ReturnType<typeof useServerStatus>> = Symbol('ServerStatus')

export function useServerStatus(serverRef: Ref<{ host: string; port?: number }>, protocol: Ref<number | undefined>) {
  const pingServer = usePingServer()
  const unknownStatus = useUnknown()
  const cache = injection(kServerStatusCache)
  const serverId = computed(() => `${serverRef.value.host}:${serverRef.value.port ?? 25565}`)
  watch(serverId, () => {
    if (!cache.value[serverId.value]) {
      cache.value[serverId.value] = unknownStatus.value
    }
  }, { immediate: true })
  const status = computed<ServerStatus>({
    get() { return cache.value[serverId.value] ?? unknownStatus.value },
    set(v) {
      cache.value[serverId.value] = v
      localStorage.setItem('serverStatusCache', JSON.stringify(cache.value))
    } })
  const pinging = ref(false)
  /**
   * Refresh the server status using a stale-while-revalidate strategy: the
   * currently cached status (favicon, MOTD, players) stays on screen while the
   * ping is in flight, so the row never blanks out to a placeholder. When the
   * new ping comes back without a favicon (server temporarily unreachable) the
   * previously cached favicon is preserved — only the live fields (players,
   * ping, and the failure description) are replaced.
   */
  async function refresh() {
    const server = serverRef.value
    if (!server.host) return
    const id = serverId.value
    pinging.value = true
    try {
      const result = await pingServer({
        host: server.host,
        port: server.port,
        protocol: protocol.value,
      })
      const prev = cache.value[id]
      if (prev?.favicon && !result.favicon) {
        result.favicon = prev.favicon
      }
      status.value = result
      pingedAt.set(id, Date.now())
    } finally {
      pinging.value = false
    }
  }

  /**
   * Refresh only when the cached status is older than `maxAge`. Lets multiple
   * components mounting the same server share a single ping instead of each
   * firing its own on mount. Pass `maxAge = 0` to always refresh.
   */
  async function refreshIfStale(maxAge = SERVER_STATUS_TTL) {
    const server = serverRef.value
    if (!server.host) return
    if (Date.now() - pingedAt.get(serverId.value) < maxAge) return
    await refresh()
  }

  function reset() {
    status.value = unknownStatus.value
  }

  return {
    status,
    pinging,
    refresh,
    refreshIfStale,
    reset }
}
