import { useService } from '@/composables'
import { generateBaseName, generateDistinctName } from '@/util/instanceName'
import { CreateInstanceOption, Instance, InstanceData, InstanceFile, InstanceInstallServiceKey, InstanceServiceKey, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import type { GameProfile } from '@xmcl/user'
import { InjectionKey, Ref, reactive } from 'vue'

export type InstanceCreation = ReturnType<typeof useInstanceCreation>

export const kInstanceCreation: InjectionKey<InstanceCreation> = Symbol('CreateOption')

/**
 * Hook to create a general instance
 */
export function useInstanceCreation(gameProfile: Ref<GameProfile>, instances: Ref<Instance[]>) {
  const { createInstance: create } = useService(InstanceServiceKey)
  const { getLatestMinecraftRelease } = useService(VersionMetadataServiceKey)
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  let latest = ''
  getLatestMinecraftRelease().then(v => {
    latest = v
    if (data.runtime.minecraft === '') {
      data.runtime.minecraft = latest
    }
  })
  const getNewRuntime = () => ({
    minecraft: latest || '',
    forge: '',
    liteloader: '',
    fabricLoader: '',
    yarn: '',
    optifine: '',
    quiltLoader: '',
    neoForged: '',
  })
  const data = reactive<InstanceData>({
    name: '',
    runtime: getNewRuntime(),
    version: '',
    java: '',
    showLog: undefined,
    hideLauncher: undefined,
    vmOptions: [] as string[],
    mcOptions: [] as string[],
    maxMemory: undefined,
    minMemory: undefined,
    author: gameProfile.value.name,
    fileApi: '',
    modpackVersion: '',
    description: '',
    resolution: undefined,
    url: '',
    icon: '',
    server: null,
    tags: [],
    assignMemory: undefined,
    fastLaunch: undefined,
  })
  const files: Ref<InstanceFile[]> = ref([])
  const loading = ref(false)
  const error = ref<any>(null)

  async function update(template: CreateInstanceOption, filesPromise: Promise<InstanceFile[]>) {
    data.name = template.name
    if (template.runtime) {
      data.runtime = { ...template.runtime }
    }
    data.java = template.java ?? ''
    data.showLog = template.showLog
    data.hideLauncher = template.hideLauncher
    data.vmOptions = [...template.vmOptions ?? []]
    data.mcOptions = [...template.mcOptions ?? []]
    data.maxMemory = template.maxMemory ?? 0
    data.minMemory = template.minMemory ?? 0
    data.author = template.author ?? ''
    data.description = template.description ?? ''
    data.url = template.url ?? ''
    data.icon = template.icon ?? ''
    data.modpackVersion = template.modpackVersion || ''
    data.server = template.server ? { ...template.server } : null
    data.upstream = template.upstream

    try {
      loading.value = true
      files.value = await filesPromise
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  function reset() {
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
    data.resolution = undefined
    data.url = ''
    data.icon = ''
    data.server = null
    data.modpackVersion = ''
    data.description = ''
    error.value = null
    files.value = []
    loading.value = false
  }
  return {
    data,
    files,
    loading,
    error,

    update,
    /**
     * Commit this creation. It will create and select the instance.
     */
    async create(onCreated?: (newPath: string) => void) {
      try {
        loading.value = true
        const runtime = { ...data.runtime }
        if (!data.name) {
          data.name = generateDistinctName(generateBaseName(runtime), instances.value.map(i => i.name))
        }
        const pendingFiles = [...files.value]
        const newPath = await create({
          ...data,
          resourcepacks: pendingFiles.some(f => f.path.startsWith('resourcepacks')),
          shaderpacks: pendingFiles.some(f => f.path.startsWith('shaderpacks')),
        })
        onCreated?.(newPath)
        reset()
        if (pendingFiles.length > 0) {
          await installInstanceFiles(data.upstream ?{
            path: newPath,
            files: pendingFiles,
            upstream: data.upstream,
          } : {
            path: newPath,
            oldFiles: [],
            files: pendingFiles,
          }).catch((e) => {
            console.error(e)
          })
        }
        return newPath
      } catch (e) {
        error.value = e
      } finally {
        loading.value = false
      }
    },
    /**
     * Reset the change
     */
    reset,
  }
}
