import { injection } from '@/util/inject';
import { useDebounceFn } from '@vueuse/core';
import { InstanceModpackMetadataSchema, InstanceServiceKey } from '@xmcl/runtime-api';
import { kInstance } from './instance';
import { useService } from './service';

export function useInstanceModpackMetadata() {
  const { path } = injection(kInstance)
  const { getInstanceModpackMetadata, setInstanceModpackMetadata } = useService(InstanceServiceKey)
  const modpackMetadata = shallowReactive<InstanceModpackMetadataSchema>({
    version: 0,
    exportDirectory: '',
    modpackVersion: '0.0.1',
    emitCurseforge: true,
    emitModrinth: true,
    emitModrinthStrict: true,
    emitOffline: false,
    emittedFiles: [],
  })

  onMounted(() => {
    getInstanceModpackMetadata(path.value).then((metadata) => {
      if (metadata) {
        Object.assign(modpackMetadata, metadata)
      }
    })
  })

  const saveMetadata = useDebounceFn(() => {
    setInstanceModpackMetadata(path.value, modpackMetadata)
  }, 1000)

  watch(modpackMetadata, () => {
    saveMetadata()
  }, { deep: true })

  return {
    modpackMetadata,
  }
}
