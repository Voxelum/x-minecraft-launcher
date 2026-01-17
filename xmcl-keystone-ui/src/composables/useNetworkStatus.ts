import { BaseServiceKey, NetworkStatus } from '@xmcl/runtime-api'
import { useService } from './service'
import { Ref, shallowRef, InjectionKey } from 'vue'
import { useInterval } from '@vueuse/core'

export const kNetworkStatus: InjectionKey<ReturnType<typeof useNetworkStatus>> = Symbol('NETWORK_STATUS')

export function useNetworkStatus() {
  const { getNetworkStatus, on } = useService(BaseServiceKey)
  const status: Ref<NetworkStatus | null> = shallowRef(null)
  const { counter, pause, resume } = useInterval(1000, { controls: true })
  const update = async () => {
    status.value = await getNetworkStatus()
  }

  on('network-status-activity', (newStatus) => {
    if (newStatus) {
      resume()
    } else {
      pause()
    }
  })

  watch(counter, update)

  onMounted(() => {
    getNetworkStatus().then((s) => {
      status.value = s
      if (s.downloadSpeed || Object.keys(s.pools).length > 0) {
        resume()
      }
    })
  })

  return {
    status,
  }
}
