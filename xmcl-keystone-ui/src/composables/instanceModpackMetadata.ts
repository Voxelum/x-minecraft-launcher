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
    emittedServerFiles: [],
    filesEnvironments: {},
    modrinth: {
      projectId: '',
      profile: 'client',
      versionType: 'release',
      pendingProjectStatus: undefined,
      lastVersionId: '',
      lastPublishedAt: 0,
      lastPublishedFiles: [],
      artifacts: [],
    },
  })

  let loadVersion = 0
  watch(path, async (instancePath) => {
    const version = ++loadVersion
    if (!instancePath) return
    const metadata = await getInstanceModpackMetadata(instancePath)
    if (version === loadVersion && metadata) {
      Object.assign(modpackMetadata, metadata)
    }
  }, { immediate: true })

  const saveMetadata = useDebounceFn(() => {
    setInstanceModpackMetadata(path.value, JSON.parse(JSON.stringify(modpackMetadata)))
  }, 1000)

  watch(modpackMetadata, () => {
    saveMetadata()
  }, { deep: true })

  return {
    modpackMetadata,
  }
}
