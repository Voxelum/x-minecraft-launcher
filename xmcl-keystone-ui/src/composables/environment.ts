import { BaseServiceKey, Environment } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useService } from './service'

export function useEnvironment() {
  const { getEnvironment } = useService(BaseServiceKey)
  const env: Ref<Environment | undefined> = ref(undefined)
  getEnvironment().then(v => {
    env.value = v
  })
  return env
}
