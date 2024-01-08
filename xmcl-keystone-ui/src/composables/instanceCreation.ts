import { useService } from '@/composables'
import { generateBaseName, generateDistinctName } from '@/util/instanceName'
import { Instance, InstanceData, InstanceFile, InstanceServiceKey, VersionMetadataServiceKey } from '@xmcl/runtime-api'
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
export function useInstanceCreation(gameProfile: Ref<GameProfile>, instances: Ref<Instance[]>) {
  const { createInstance: create } = useService(InstanceServiceKey)
  const { getLatestMinecraftRelease } = useService(VersionMetadataServiceKey)
  let latest = ''
  getLatestMinecraftRelease().then(v => { latest = v })
  const getNewRuntime = () => ({
    minecraft: latest || '',
    forge: '',
    liteloader: '',
    fabricLoader: '',
    yarn: '',
    quiltLoader: '',
    neoForged: '',
  })
  const data = reactive<InstanceData>({
    name: '',
    runtime: getNewRuntime(),
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
      const runtime = { ...data.runtime }
      if (!data.name) {
        data.name = generateDistinctName(generateBaseName(runtime), instances.value.map(i => i.name))
      }
      const newPath = await create(data)
      return newPath
    },
    /**
     * Reset the change
     */
    reset() {
      data.name = ''
      data.runtime = getNewRuntime()
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
      files.value = []
    },
  }
}
