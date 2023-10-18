import { useService } from '@/composables'
import { generateDistinctName } from '@/util/instanceName'
import { Instance, InstanceData, InstanceServiceKey, LocalVersionHeader, RuntimeVersions } from '@xmcl/runtime-api'
import type { GameProfile } from '@xmcl/user'
import { InjectionKey, Ref, reactive } from 'vue'
import { useMinecraftVersions } from './version'

export const kInstanceCreation: InjectionKey<InstanceData> = Symbol('CreateOption')

/**
 * Hook to create a general instance
 */
export function useInstanceCreation(gameProfile: Ref<GameProfile>, versions: Ref<LocalVersionHeader[]>, instances: Ref<Instance[]>, path: Ref<string>) {
  const { createInstance: create } = useService(InstanceServiceKey)
  const { release } = useMinecraftVersions(versions)
  const data = reactive<InstanceData>({
    name: '',
    runtime: { forge: '', minecraft: release.value?.id || '', liteloader: '', fabricLoader: '', yarn: '', labyMod: '' } as RuntimeVersions,
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
  return {
    data,
    /**
     * Commit this creation. It will create and select the instance.
     */
    async create() {
      if (!data.name) {
        data.name = generateDistinctName(instances.value.map(i => i.name), data.runtime)
      }
      const newPath = await create(data)
      path.value = newPath
      return newPath
    },
    /**
     * Reset the change
     */
    reset() {
      data.name = ''
      data.runtime = {
        minecraft: release.value?.id || '',
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
