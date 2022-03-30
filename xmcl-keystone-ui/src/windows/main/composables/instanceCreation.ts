import { InjectionKey, reactive, ToRefs, toRefs } from '@vue/composition-api'
import { InstanceData, InstanceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import { useCurrentUser } from './user'
import { useMinecraftVersions } from './version'
import { useService } from '/@/composables'

export const CreateOptionKey: InjectionKey<ToRefs<InstanceData>> = Symbol('CreateOption')

/**
 * Hook to create a general instance
 */
export function useInstanceCreation() {
  const { gameProfile } = useCurrentUser()
  const { createAndMount: createAndSelect } = useService(InstanceServiceKey)
  const { release } = useMinecraftVersions()
  const data = reactive<InstanceData>({
    name: '',
    runtime: { forge: '', minecraft: release.value?.id || '', liteloader: '', fabricLoader: '', yarn: '' } as RuntimeVersions,
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
  })
  return {
    ...toRefs(data),
    /**
     * Commit this creation. It will create and select the instance.
     */
    create() {
      return createAndSelect(data)
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
