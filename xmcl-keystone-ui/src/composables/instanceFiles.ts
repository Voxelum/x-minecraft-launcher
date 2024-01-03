import { InstanceFile, InstanceInstallServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import debounce from 'lodash.debounce'

export const kInstanceFiles: InjectionKey<ReturnType<typeof useInstanceFiles>> = Symbol('InstanceFiles')

export function useInstanceFiles(instancePath: Ref<string>) {
  const files: Ref<InstanceFile[]> = ref([])
  const { checkInstanceInstall, installInstanceFiles } = useService(InstanceInstallServiceKey)

  let abortController = new AbortController()
  const { mutate, error, isValidating } = useSWRV(computed(() => instancePath.value), async () => {
    if (!instancePath.value) { return }
    abortController.abort()
    abortController = new AbortController()
    const abortSignal = abortController.signal
    const result = await checkInstanceInstall(instancePath.value)
    // If abort, just ignore this result
    if (abortSignal.aborted) { return }
    files.value = result
  })

  const _validating = ref(false)
  const update = debounce(() => {
    _validating.value = isValidating.value
  }, 400)
  watch(isValidating, update)

  async function install() {
    if (files.value.length > 0) {
      // has unfinished files
      try {
        await installInstanceFiles({ files: files.value, path: instancePath.value })
      } finally {
        mutate()
      }
    }
  }

  return {
    files,
    isValidating: _validating,
    mutate,
    error,
    install,
  }
}
