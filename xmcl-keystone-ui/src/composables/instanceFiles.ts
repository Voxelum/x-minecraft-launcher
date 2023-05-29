import { InstanceFile, InstanceInstallServiceKey } from '@xmcl/runtime-api'
import { Ref, InjectionKey } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export const kInstanceFiles: InjectionKey<ReturnType<typeof useInstanceFiles>> = Symbol('InstanceFiles')

export function useInstanceFiles(instancePath: Ref<string>) {
  const files: Ref<InstanceFile[]> = ref([])
  const { checkInstanceInstall, installInstanceFiles } = useService(InstanceInstallServiceKey)

  let abortController = new AbortController()
  const { refresh, error, refreshing } = useRefreshable(async () => {
    if (!instancePath.value) { return }
    abortController.abort()
    abortController = new AbortController()
    const abortSignal = abortController.signal
    const result = await checkInstanceInstall(instancePath.value)
    // If abort, just ignore this result
    if (abortSignal.aborted) { return }
    files.value = result
  })

  async function install() {
    if (files.value.length > 0) {
      // has unfinished files
      try {
        await installInstanceFiles({ files: files.value, path: instancePath.value })
      } finally {
        refresh()
      }
    } else {
      refresh()
    }
  }

  onMounted(() => refresh())
  watch(instancePath, () => refresh())

  return {
    files,
    refreshing,
    refresh,
    error,
    install,
  }
}
