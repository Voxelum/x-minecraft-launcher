import { NatDeviceInfo, NatServiceKey, NatState } from '@xmcl/runtime-api'
import { set } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export function useNatState() {
  const { getNatState } = useService(NatServiceKey)
  const { state, isValidating, error } = useState(getNatState, class extends NatState {
    override natAddressSet(address: string): void {
      set(this, 'natAddress', address)
    }

    override natDeviceSet(device: NatDeviceInfo): void {
      set(this, 'natDevice', device)
    }
  })
  const natType = computed(() => state.value?.natType ?? 'Unknown')
  const externalIp = computed(() => state.value?.externalIp ?? '')
  const externalPort = computed(() => state.value?.externalPort ?? 0)
  const localIp = computed(() => state.value?.localIp ?? '')
  const natDevice = computed(() => state.value?.natDevice ?? undefined)
  return {
    natType,
    externalIp,
    externalPort,
    localIp,
    natDevice,
    isValidating,
    error,
  }
}
