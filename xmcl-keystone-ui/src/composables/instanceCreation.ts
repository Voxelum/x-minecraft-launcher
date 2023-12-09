import { useService } from '@/composables'
import { generateBaseName, generateDistinctName } from '@/util/instanceName'
import { Instance, InstanceData, InstanceFile, InstanceInstallServiceKey, InstanceServiceKey, LocalVersionHeader, RuntimeVersions, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import type { GameProfile } from '@xmcl/user'
import { InjectionKey, Ref, reactive } from 'vue'

export const kInstanceCreation: InjectionKey<{
  data: InstanceData
  files: Ref<InstanceFile[]>
  loading: Ref<boolean>
  error: Ref<any>
  loadFiles?: () => Promise<InstanceFile[]>
}> = Symbol('CreateOption')

/**
 * Hook to create a general instance
 */
export function useInstanceCreation(gameProfile: Ref<GameProfile>, versions: Ref<LocalVersionHeader[]>, instances: Ref<Instance[]>, path: Ref<string>) {
  const { createInstance: create } = useService(InstanceServiceKey)
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  const { getLatestMinecraftRelease } = useService(VersionMetadataServiceKey)
  let latest = ''
  getLatestMinecraftRelease().then(v => { latest = v })
  const data = reactive<InstanceData>({
    name: '',
    runtime: { forge: '', minecraft: latest || '', liteloader: '', fabricLoader: '', yarn: '', labyMod: '' } as RuntimeVersions,
    version: '',
    java: '',
    showLog: false,
    hideLauncher: true,
    vmOptions: [] as string[],
    mcOptions: [] as string[],
    maxMemory: 0,
    minMemory: 0,
    author: gameProfile.value.name,
    fileApi: '',
    modpackVersion: '',
    description: '',
    resolution: null,
    url: '',
    icon: '',
    server: null,
    tags: [],
    assignMemory: false,
    fastLaunch: false,
  })
  const files: Ref<InstanceFile[]> = ref([])
  return {
    data,
    files,
    /**
     * Commit this creation. It will create and select the instance.
     */
    async create() {
      if (!data.name) {
        data.name = generateDistinctName(generateBaseName(data.runtime), instances.value.map(i => i.name))
      }
      const newPath = await create(data)
      if (files.value.length > 0) {
        await installInstanceFiles({
          path: newPath,
          files: files.value,
        })
      }
      path.value = newPath
      return newPath
    },
    /**
     * Reset the change
     */
    reset() {
      data.name = ''
      data.runtime = {
        minecraft: latest || '',
        forge: '',
        liteloader: '',
        fabricLoader: '',
        yarn: '',
      }
      data.java = ''
      data.showLog = false
      data.hideLauncher = true
      data.vmOptions = []
      data.mcOptions = []
      data.maxMemory = 0
      data.minMemory = 0
      data.author = gameProfile.value.name
      data.description = ''
      data.resolution = null
      data.url = ''
      data.icon = ''
      data.server = null
      data.modpackVersion = ''
      data.description = ''
    },
  }
}
