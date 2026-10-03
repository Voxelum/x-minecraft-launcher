import { useService } from './service'
import { InstanceSaveProgress, InstanceSavesServiceKey } from '@xmcl/runtime-api'
import { Ref, ref, shallowRef, watch, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'

const requests = new Map<string, Promise<InstanceSaveProgress>>()

export function useInstanceSaveProgress(savePath: Ref<string | undefined>, instancePath?: Ref<string | undefined>, version?: Ref<string>) {
  const { getInstanceSaveProgress } = useService(InstanceSavesServiceKey)
  const { locale } = useI18n()
  const progress = shallowRef<InstanceSaveProgress>()
  const loading = ref(false)
  const error = shallowRef<unknown>()
  let generation = 0
  onScopeDispose(() => { generation++ })

  async function refresh() {
    const requestGeneration = ++generation
    const path = savePath.value
    progress.value = undefined
    error.value = undefined
    if (!path) {
      loading.value = false
      return
    }
    loading.value = true
    const key = JSON.stringify([path, instancePath?.value, locale.value, version?.value])
    try {
      let request = requests.get(key)
      if (!request) {
        request = getInstanceSaveProgress({
          savePath: path,
          instancePath: instancePath?.value,
          locale: locale.value,
        }).finally(() => requests.delete(key))
        requests.set(key, request)
      }
      const result = await request
      if (requestGeneration === generation) progress.value = result
    } catch (e) {
      if (requestGeneration === generation) error.value = e
    } finally {
      if (requestGeneration === generation) loading.value = false
    }
  }

  watch([savePath, () => instancePath?.value, locale, () => version?.value], () => {
    refresh()
  }, { immediate: true })

  return {
    progress,
    loading,
    error,
    refresh,
  }
}
