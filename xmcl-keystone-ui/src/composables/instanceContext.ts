import { InjectionKey } from 'vue'
import { useInstance, useInstanceIsServer } from './instance'
import { useLaunchIssue } from './launchIssue'
import { useLaunchTask } from './launchTask'
import { useModsSearch } from './modSearch'
import { useModSearchItems } from './modSearchItems'
import { useInstanceMods } from './mod'
import { useInstanceOptions } from './instanceOptions'
import { useInstanceJava } from './instanceJava'
import { useInstanceVersion } from './instanceVersion'

/**
 * The context to hold the instance related data. This is used to share data between different components.
 */
export function useInstanceContext() {
  const issue = useLaunchIssue()
  const { path, instance, refreshing } = useInstance()
  const name = computed(() => instance.value.name)
  const { runtime, versionHeader, resolvedVersion, minecraft, forge, fabricLoader, folder, quiltLoader } = useInstanceVersion(instance)
  const task = useLaunchTask(path, runtime, versionHeader)
  const { java } = useInstanceJava(instance, resolvedVersion)
  const isServer = useInstanceIsServer(instance)

  const options = useInstanceOptions(instance)
  const modSearch = useModsSearch(ref(''), runtime)
  const modSearchItems = useModSearchItems(modSearch.keyword, modSearch.modrinth, modSearch.curseforge, modSearch.mods, modSearch.existedMods)
  const mods = useInstanceMods(runtime, java)

  return {
    issue,
    task,
    path,
    name,
    mods,
    options,
    version: runtime,
    resolvedVersion,
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
