import { InstanceFile, InstanceInstallServiceKey } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref, ShallowRef } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'
import { useDialog } from './dialog'

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

  interface ChecksumErrorFile { file: InstanceFile; expect: string; actual: string }

  const checksumErrorCount = shallowRef(undefined as undefined | { key: string; count: number; files: ChecksumErrorFile[] })
  const shouldHintUserSkipChecksum = computed(() => checksumErrorCount.value?.count)
  const blockingFiles = computed(() => checksumErrorCount.value?.files)

  function countUpChecksumError(key: string, files: ChecksumErrorFile[]) {
    if (checksumErrorCount.value?.key === key) {
      checksumErrorCount.value = { ...checksumErrorCount.value, count: checksumErrorCount.value.count + 1}
    } else {
      checksumErrorCount.value = { key, count: 1, files: files.filter(f => !!f.file) }
    }
  }

  function isChecksumError(e: any) {
    return typeof e === 'object' && e.name === 'ChecksumNotMatchError'
  }

  async function installFiles(path: string, files: InstanceFile[]) {
    function getFile(sha1: string) {
      return files.find(f => f.hashes.sha1 === sha1)
    }
    if (files.length > 0) {
      try {
        await installInstanceFiles({
          path,
          files,
        })
      } catch (e) {
        if (e instanceof Array) {
          if (e.every(isChecksumError)) {
            countUpChecksumError(e.map(e => e.expect).join(), e.map(e => ({ file: getFile(e.expect)!, expect: e.expect, actual: e.actual })))
          }
        } else {
          if (isChecksumError(e)) {
            countUpChecksumError((e as any).expect, [{ file: getFile((e as any).expect)!, expect: (e as any).expect, actual: (e as any).actual }])
          }
        }
      } finally {
        mutate()
      }
    }
  }

  function resetChecksumError() {
    checksumErrorCount.value = undefined
  }

  return {
    files: computed(() => instanceFiles.value?.files || []),
    shouldHintUserSkipChecksum,
    resetChecksumError,
    blockingFiles,
    instanceFiles,
    isValidating: _validating,
    installFiles,
    mutate,
    error,
  }
}
