import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { generateBaseName, generateDistinctName, getEffectiveInstanceName } from '@/util/instanceName'
import { InstanceInstallServiceKey, InstanceResourcePacksServiceKey, InstanceSavesServiceKey, InstanceServiceKey, InstanceShaderPacksServiceKey, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import type { GameProfile } from '@xmcl/user'
import { useLocalStorage } from '@vueuse/core'
import { InjectionKey, Ref, reactive } from 'vue'
import { kLatestMinecraftVersion } from './version'
import { useNotifier } from './notifier'
import { CreateInstanceOptions, Instance, InstanceData, InstanceFile } from '@xmcl/instance'

export type InstanceCreation = ReturnType<typeof useInstanceCreation>

export const kInstanceCreation: InjectionKey<InstanceCreation> = Symbol('CreateOption')

/**
 * Launcher-wide preferences that decide whether a manually created instance
 * should link its `saves` / `resourcepacks` / `shaderpacks` folder to the
 * global shared folder instead of using an ordinary instance-owned directory.
 *
 * These are creation-time defaults for the manual Add Instance form only. They
 * are NOT part of the runtime instance schema and are never applied to imported
 * modpacks/templates.
 */
export interface InstanceCreationLinkPreferences {
  version: number
  saves: boolean
  resourcepacks: boolean
  shaderpacks: boolean
}

const DEFAULT_LINK_PREFERENCES: InstanceCreationLinkPreferences = {
  version: 1,
  saves: false,
  resourcepacks: false,
  shaderpacks: false,
}

/**
 * The runtime link operations, one per supported shared folder. Each mirrors
 * the corresponding local-view link switch (`linkSharedSave` /
 * `linkShared`), so creation-time links share the exact merge/backup semantics.
 */
export interface InstanceLinkOperations {
  linkSaves: (instancePath: string) => Promise<void>
  linkResourcePacks: (instancePath: string) => Promise<void>
  linkShaderPacks: (instancePath: string) => Promise<void>
}

/**
 * Apply the checked shared-folder links for a freshly created instance.
 *
 * Each link is applied independently and failure-tolerantly: one failing
 * operation neither aborts the others nor claims success. The returned array
 * lists the folders that failed so the caller can report them per folder while
 * leaving the instance usable with an ordinary directory for the failures.
 */
export async function applyInstanceLinkPreferences(
  instancePath: string,
  preferences: Pick<InstanceCreationLinkPreferences, 'saves' | 'resourcepacks' | 'shaderpacks'>,
  operations: InstanceLinkOperations,
): Promise<string[]> {
  const tasks: Array<{ folder: string; run: () => Promise<void> }> = []
  if (preferences.saves) tasks.push({ folder: 'saves', run: () => operations.linkSaves(instancePath) })
  if (preferences.resourcepacks) tasks.push({ folder: 'resourcepacks', run: () => operations.linkResourcePacks(instancePath) })
  if (preferences.shaderpacks) tasks.push({ folder: 'shaderpacks', run: () => operations.linkShaderPacks(instancePath) })
  const failed: string[] = []
  for (const task of tasks) {
    try {
      await task.run()
    } catch (e) {
      console.error(e)
      failed.push(task.folder)
    }
  }
  return failed
}

/**
 * Hook to create a general instance
 */
export function useInstanceCreation(gameProfile: Ref<GameProfile>, instances: Ref<Instance[]>) {
  const { createInstance: create } = useService(InstanceServiceKey)
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  const { linkSharedSave } = useService(InstanceSavesServiceKey)
  const { linkShared: linkSharedResourcePacks } = useService(InstanceResourcePacksServiceKey)
  const { linkShared: linkSharedShaderPacks } = useService(InstanceShaderPacksServiceKey)
  const { notify } = useNotifier()
  const { t } = useI18n()
  const { release } = injection(kLatestMinecraftVersion)
  watch(release, (v) => {
    if (v && data.runtime.minecraft === '') {
      data.runtime.minecraft = v
    }
  })
  const placeHolderName = computed(() => {
    if (data.edition === 'bedrock') {
      return generateDistinctName('Bedrock', instances.value.map(i => i.name))
    }
    return generateDistinctName(generateBaseName(data.runtime), instances.value.map(i => i.name))
  })
  const getNewRuntime = () => ({
    minecraft: release.value || '',
    forge: '',
    fabricLoader: '',
    optifine: '',
    quiltLoader: '',
    neoForged: '',
    labyMod: '',
  })
  const data = reactive<InstanceData>({
    name: '',
    runtime: getNewRuntime(),
    version: '',
    edition: 'java',
    java: '',
    showLog: undefined,
    hideLauncher: undefined,
    vmOptions: [] as string[],
    mcOptions: [] as string[],
    maxMemory: undefined,
    minMemory: undefined,
    author: gameProfile.value.name,
    fileApi: '',
    description: '',
    resolution: undefined,
    url: '',
    icon: '',
    server: null,
    assignMemory: undefined,
    fastLaunch: undefined,
  })
  // TODO: check if we can use shallowRef
  const files: Ref<InstanceFile[]> = ref([])
  const loading = ref(false)
  const error = shallowRef<any>(null)

  /**
   * Persisted launcher-wide manual-create link preferences. Missing or
   * malformed data falls back to all-unchecked. These are read/written directly
   * by the Advanced section checkboxes; they are only *applied* on a genuinely
   * manual creation (see `isManual`).
   */
  const linkPreferences = useLocalStorage<InstanceCreationLinkPreferences>(
    'addInstanceLinkPreferences',
    () => ({ ...DEFAULT_LINK_PREFERENCES }),
    { mergeDefaults: true, writeDefaults: false },
  )

  /**
   * Whether the current form represents a genuinely manual new-instance flow.
   * Any import/template flow calls `update()` which flips this to `false`, so
   * remembered link preferences never leak into imported modpacks. `reset()`
   * restores it to `true` for the next manual creation.
   */
  const isManual = ref(true)

  async function update(template: CreateInstanceOptions, filesPromise: Promise<InstanceFile[]>) {
    isManual.value = false
    data.name = template.name
    if (template.runtime) {
      data.runtime = { ...data.runtime, ...template.runtime }
    }
    data.edition = template.edition ?? 'java'
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
    data.edition = 'java'
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
    data.description = ''
    error.value = null
    files.value = []
    loading.value = false
    isManual.value = true
  }
  return {
    data,
    files,
    loading,
    error,
    placeHolderName,
    linkPreferences,
    isManual,
    update,
    /**
     * Commit this creation. It will create and select the instance.
     */
    async create(onCreated?: (newPath: string) => void) {
      try {
        loading.value = true
        // Snapshot the manual-create link intent BEFORE `reset()` runs (reset
        // flips `isManual` back to true and the folder links must never be
        // synthesized for an import/template flow).
        const shouldApplyLinks = isManual.value && data.edition !== 'bedrock'
        const linkSnapshot: InstanceCreationLinkPreferences = { ...linkPreferences.value }
        const name = getEffectiveInstanceName(data.name, placeHolderName.value)
        if (!name) {
          error.value = new Error('Instance name is required')
          return
        }
        data.name = name
        // Convert reactive refs into plain serializable objects for service calls.
        const pendingFiles = JSON.parse(JSON.stringify(files.value)) as InstanceFile[]
        const pendingUpstream = data.upstream
          ? JSON.parse(JSON.stringify(data.upstream))
          : undefined
        const payload = JSON.parse(JSON.stringify({
          ...data,
          resourcepacks: pendingFiles.some(f => f.path.startsWith('resourcepacks')),
          shaderpacks: pendingFiles.some(f => f.path.startsWith('shaderpacks')),
        })) as CreateInstanceOptions
        if (!payload.minMemory) payload.minMemory = undefined
        if (!payload.maxMemory) payload.maxMemory = undefined
        if (payload.vmOptions?.length === 0) payload.vmOptions = undefined
        if (payload.mcOptions?.length === 0) payload.mcOptions = undefined
        delete payload.hideLauncher
        delete payload.showLog
        const newPath = await create(payload)
        onCreated?.(newPath)
        reset()
        if (pendingFiles.length > 0) {
          await installInstanceFiles(pendingUpstream ? {
            path: newPath,
            files: pendingFiles,
            upstream: pendingUpstream,
          } : {
            path: newPath,
            oldFiles: [],
            files: pendingFiles,
          }).catch((e) => {
            console.error(e)
          })
        }
        // Manual-create only: link the selected shared folders using the same
        // runtime services as the local link switches. Each link is applied
        // independently so one failure does not hide the others, and the
        // instance stays usable with an ordinary folder for any failed link.
        if (shouldApplyLinks && (linkSnapshot.saves || linkSnapshot.resourcepacks || linkSnapshot.shaderpacks)) {
          const failed = await applyInstanceLinkPreferences(newPath, linkSnapshot, {
            linkSaves: linkSharedSave,
            linkResourcePacks: linkSharedResourcePacks,
            linkShaderPacks: linkSharedShaderPacks,
          })
          for (const folder of failed) {
            notify({ level: 'error', title: t('instances.linkFailed', { folder }) })
          }
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
