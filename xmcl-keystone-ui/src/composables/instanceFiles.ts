import { InstanceFile, InstanceInstallServiceKey, InstanceInstallStatus } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export const kInstanceFiles: InjectionKey<ReturnType<typeof useInstanceFiles>> = Symbol('InstanceFiles')

export interface InstanceFilesStatus {
  files: InstanceFile[]
  instance: string
}

export function useInstanceFiles(instancePath: Ref<string>) {
  const { watchInstanceInstall, resumeInstanceInstall } = useService(InstanceInstallServiceKey)
  const { error, isValidating, state: instanceFileStatus } = useState(() => watchInstanceInstall(instancePath.value), InstanceInstallStatus)

  const _validating = ref(false)
  const update = debounce(() => {
    _validating.value = isValidating.value
  }, 400)
  watch(isValidating, update)

  interface ChecksumErrorFile { file: InstanceFile; expect: string; actual: string }

  const checksumErrorCount = shallowRef(undefined as undefined | { key: string; count: number; files: ChecksumErrorFile[] })
  const unzipFileNotFound = shallowRef(undefined as undefined | string)
  const shouldHintUserSkipChecksum = computed(() => checksumErrorCount.value?.count)
  const blockingFiles = computed(() => checksumErrorCount.value?.files)
  const unresolvedFiles = computed(() => instanceFileStatus.value?.unresolvedFiles)

  function countUpChecksumError(key: string, files: ChecksumErrorFile[]) {
    if (checksumErrorCount.value?.key === key) {
      checksumErrorCount.value = { ...checksumErrorCount.value, count: checksumErrorCount.value.count + 1 }
    } else {
      checksumErrorCount.value = { key, count: 1, files: files.filter(f => !!f.file) }
    }
  }

  async function resumeInstall(instancePath: string, bypass?: InstanceFile[]) {
    const errors = await resumeInstanceInstall(instancePath, bypass)
    if (errors) {
      const checksumErrors = errors.filter(e => e.name === 'ChecksumNotMatchError') as ChecksumErrorFile[]
      countUpChecksumError(checksumErrors.map(e => e.expect).join(), checksumErrors.map(e => ({ file: e.file, expect: e.expect, actual: e.actual })))
      const unzipErrors = errors.filter(e => e.name === 'UnpackZipFileNotFoundError').map(e => e as { file: string })
      if (unzipErrors[0]?.file) {
        unzipFileNotFound.value = unzipErrors[0].file
      }
    }
  }

  function resetChecksumError() {
    checksumErrorCount.value = undefined
  }

  return {
    instanceInstallStatus: instanceFileStatus,
    shouldHintUserSkipChecksum,
    unresolvedFiles,
    unzipFileNotFound,
    resumeInstall,
    resetChecksumError,
    blockingFiles,
    isValidating: _validating,
    error,
  }
}
