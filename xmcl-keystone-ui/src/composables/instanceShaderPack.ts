import { InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'
import { Ref } from 'vue'

export function useInstanceShaderPacks(instancePath: Ref<string>) {
  const { link } = useService(InstanceShaderPacksServiceKey)

  watch(instancePath, () => {
    link(instancePath.value)
  }, { immediate: true })
}
