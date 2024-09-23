import { Instance, PingServerOptions, ServerStatus, ServerStatusServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref, computed, ref, set, watch } from 'vue'

import { useService } from '@/composables'
import { useLocalStorageCache } from '@/composables/cache'
import { injection } from '@/util/inject'
import { kInstances } from './instances'

export const kServerStatusCache: InjectionKey<Ref<Record<string, ServerStatus>>> = Symbol('ServerStatusCache')

export function useInstanceServerStatus(instance: Ref<Instance | undefined>) {
  return useServerStatus(computed(() => instance.value?.server ?? { host: '' }), ref(25565))
}

export function useServerStatusCache() {
  return useLocalStorageCache('serverStatusCache', () => ({}), JSON.stringify, JSON.parse)
}

function usePinging() {
  const { t } = useI18n()
  return computed(() => {
    return {
      version: {
        name: t('server.ping'),
        protocol: -1,
      },
      players: {
        max: -1,
        online: -1,
      },
      description: t('serverStatus.ping'),
      favicon: '',
      ping: 0,
    }
  })
}

function useUnknown() {
  const { t } = useI18n()
  return computed(() => {
    return {
      version: {
        name: t('server.unknown'),
        protocol: -1,
      },
      players: {
        max: -1,
        online: -1,
      },
      description: t('server.unknownDescription'),
      favicon: '',
      ping: 0,
    }
  })
}

function usePingServer() {
  const { pingServer } = useService(ServerStatusServiceKey)
  const { te, t } = useI18n()
  const tStatus = computed(() => ({
    'serverStatus.nohost': t('serverStatus.nohost'),
    'serverStatus.refuse': t('serverStatus.refuse'),
    'serverStatus.timeout': t('serverStatus.timeout'),
    'serverStatus.ping': t('serverStatus.ping'),
  } as Record<string, string>))
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
  const pingingStatus = usePinging()
  async function refreshOne(server: { host: string; port?: number }) {
    const id = `${server.host}:${server.port ?? 25565}`
    set(cache.value, id, pingingStatus.value)
    set(cache.value, id, await pingServer({
      host: server.host,
      port: server.port,
    }))
    // Workaround to force save as reactivity is broken
    localStorage.setItem('serverStatusCache', JSON.stringify(cache.value))
  }
  function refresh() {
    pinging.value = true
    return Promise.all(instances.value.map(i => i.server).filter(<T>(v: T | null): v is T => !!v).map(refreshOne)).finally(() => { pinging.value = false })
  }
  return {
    pinging,
    refresh,
  }
}

export const kServerStatus: InjectionKey<ReturnType<typeof useServerStatus>> = Symbol('ServerStatus')

export function useServerStatus(serverRef: Ref<{ host: string; port?: number }>, protocol: Ref<number | undefined>) {
  const pingServer = usePingServer()
  const unknownStatus = useUnknown()
  const cache = injection(kServerStatusCache)
  const serverId = computed(() => `${serverRef.value.host}:${serverRef.value.port ?? 25565}`)
  watch(serverId, () => {
    if (!cache.value[serverId.value]) {
      set(cache.value, serverId.value, unknownStatus.value)
    }
  }, { immediate: true })
  const status = computed<ServerStatus>({
    get() { return cache.value[serverId.value] ?? unknownStatus.value },
    set(v) {
      set(cache.value, serverId.value, v)
      localStorage.setItem('serverStatusCache', JSON.stringify(cache.value))
    },
  })
  const pingingStatus = usePinging()
  const pinging = ref(false)
  /**
     * Refresh the server status. If the server is empty, it will do nothing.
     */
  async function refresh() {
    const server = serverRef.value
    if (!server.host) return
    pinging.value = true
    status.value = pingingStatus.value
    status.value = await pingServer({
      host: server.host,
      port: server.port,
      protocol: protocol.value,
    }).finally(() => {
      pinging.value = false
    })
  }

  watch(serverRef, () => {
    reset()
  })

  function reset() {
    status.value = unknownStatus.value
  }

  return {
    status,
    pinging,
    refresh,
    reset,
  }
}
