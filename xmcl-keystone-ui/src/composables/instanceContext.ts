import { InjectionKey } from 'vue'
import { useInstance, useInstanceIsServer, useInstanceVersion } from './instance'
import { useLaunchIssue } from './launchIssue'
import { useLaunchTask } from './launchTask'
import { useModsSearch } from './modSearch'
import { useModSearchItems } from './modSearchItems'
import { useInstanceMods } from './mod'
import { useService } from './service'
import { useInstanceOptions } from './instanceOptions'

/**
 * The context to hold the instance related data. This is used to share data between different components.
 */
export function useInstanceContext() {
  const issue = useLaunchIssue()
  const { path, instance, refreshing } = useInstance()
  const name = computed(() => instance.value.name)
  const version = computed(() => instance.value.runtime)
  const { localVersion, minecraft, forge, fabricLoader, folder, quiltLoader } = useInstanceVersion()
  const task = useLaunchTask(path, version, localVersion)
  const { state: javaState } = useService(InstanceJavaServiceKey)
  const java = computed(() => javaState.java)
  const isServer = useInstanceIsServer(instance)

  const options = useInstanceOptions(instance)

  const modSearch = useModsSearch(ref(''), version)
  const modSearchItems = useModSearchItems(modSearch.keyword, modSearch.modrinth, modSearch.curseforge, modSearch.mods, modSearch.existedMods)
  const mods = useInstanceMods(version, java)

  return {
    issue,
    task,
    path,
    name,
    mods,
    version,
    options,
    localVersion,
    minecraft,
    forge,
    fabricLoader,
    folder,
    quiltLoader,
    instance,
    isServer,
    modSearch,
    modSearchItems,
    refreshing,
  }
}

export const kInstanceContext: InjectionKey<ReturnType<typeof useInstanceContext>> = Symbol('InstanceContext')
