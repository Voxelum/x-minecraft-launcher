import { computed, Ref, ref } from '@vue/composition-api'
import { useInMemoryCache } from './useCache'
import { useService } from './useService'
import { PINGING_STATUS, ServerStatus, UNKNOWN_STATUS } from '/@shared/entities/serverStatus'
import { InstanceServiceKey } from '/@shared/services/InstanceService'
import { ServerStatusServiceKey } from '/@shared/services/ServerStatusService'
import mapping from '/@shared/util/protocolToMinecraft'

export function useSeverStatusAcceptVersion(protocol: Ref<number>) {
  return computed(() => `[${mapping[protocol.value].join(', ')}]`)
}

export function useInstanceServerStatus(instancePath?: string) {
  const { state } = useService(InstanceServiceKey)
  const instance = computed(() => state.all[instancePath ?? state.path])
  const serverRef = computed(() => instance.value?.server ?? { host: '' })
  return useServer(serverRef, ref(25565))
}

export function useServer(serverRef: Ref<{ host: string; port?: number }>, protocol: Ref<number | undefined>) {
  const { pingServer } = useService(ServerStatusServiceKey)
  const status = useInMemoryCache<ServerStatus>(computed(() => `server:${serverRef.value.host}:${serverRef.value.port ?? 25565}`), () => UNKNOWN_STATUS)
  const pinging = ref(false)
  /**
     * Refresh the server status. If the server is empty, it will do nothing.
     */
  async function refresh() {
    pinging.value = true
    const server = serverRef.value
    if (!server.host) return
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

  function reset() {
    status.value = UNKNOWN_STATUS
  }

  const acceptingVersion = useSeverStatusAcceptVersion(computed(() => status.value.version.protocol))
  return {
    acceptingVersion,
    status,
    pinging,
    refresh,
    reset,
  }
}
