import { useService } from '@/composables'
import { InstanceSaveProgress, InstanceSavesServiceKey } from '@xmcl/runtime-api'
import { Ref, ref, shallowRef, watch } from 'vue'

const progressCache = new Map<string, InstanceSaveProgress>()

export function useInstanceSaveProgress(savePath: Ref<string | undefined>, instancePath?: Ref<string | undefined>) {
  const { getInstanceSaveProgress } = useService(InstanceSavesServiceKey)
  const initial = savePath.value ? progressCache.get(savePath.value) : undefined
  const progress = shallowRef<InstanceSaveProgress | undefined>(initial)
  const loading = ref(!initial && !!savePath.value)
  const error = shallowRef<any>(undefined)

  async function refresh() {
    const path = savePath.value
    if (!path) {
      progress.value = undefined
      loading.value = false
      return
    }

    const cached = progressCache.get(path)
    if (cached) {
      progress.value = cached
      loading.value = false
    } else {
      loading.value = true
    }

    error.value = undefined
    try {
      const result = await getInstanceSaveProgress({
        savePath: path,
        instancePath: instancePath?.value,
      })
      if (result) {
        progressCache.set(path, result)
        progress.value = result
      }
    } catch (e) {
      if (!progress.value) {
        error.value = e
        progress.value = undefined
      }
    } finally {
      loading.value = false
    }
  }

  watch([savePath, () => instancePath?.value], () => {
    refresh()
  }, { immediate: true })

  return {
    progress,
    loading,
    error,
    refresh,
  }
}

