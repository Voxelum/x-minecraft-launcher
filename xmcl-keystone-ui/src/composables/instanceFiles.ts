import { InstanceFile, InstanceInstallServiceKey } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref, ShallowRef } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export const kInstanceFiles: InjectionKey<ReturnType<typeof useInstanceFiles>> = Symbol('InstanceFiles')

export interface InstanceFilesStatus {
  files: InstanceFile[]
  instance: string
}

export function useInstanceFiles(instancePath: Ref<string>) {
  const instanceFiles: ShallowRef<InstanceFilesStatus | undefined> = shallowRef(undefined)
  const { checkInstanceInstall, installInstanceFiles } = useService(InstanceInstallServiceKey)

  const { error, refreshing: isValidating, refresh: mutate } = useRefreshable(async () => {
    const path = instancePath.value
    instanceFiles.value = undefined
    const result = await checkInstanceInstall(instancePath.value)
    if (path === instancePath.value) {
      instanceFiles.value = {
        files: result,
        instance: path,
      }
    }
  })

  watch(instancePath, () => mutate(), { immediate: true })

  const _validating = ref(false)
  const update = debounce(() => {
    _validating.value = isValidating.value
  }, 400)
  watch(isValidating, update)

  async function installFiles(path: string, files: InstanceFile[]) {
    if (files.length > 0) {
      await installInstanceFiles({
        path,
        files,
      }).finally(() => {
        mutate()
      })
    }
  }

  return {
    files: computed(() => instanceFiles.value?.files || []),
    instanceFiles,
    isValidating: _validating,
    installFiles,
    mutate,
    error,
  }
}
