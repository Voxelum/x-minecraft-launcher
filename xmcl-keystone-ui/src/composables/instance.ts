import { Instance } from '@xmcl/runtime-api'
import { InjectionKey, Ref, computed } from 'vue'
import { useLocalStorageCacheStringValue } from './cache'

export const kInstance: InjectionKey<ReturnType<typeof useInstance>> = Symbol('Instance')

const EMPTY_INSTANCE: Instance = {
  path: '',
  name: '',
  runtime: {
    minecraft: '',
  },
  lastAccessDate: 0,
  lastPlayedDate: 0,
  playtime: 0,
  creationDate: 0,
  author: '',
  description: '',
  version: '',
  url: '',
  icon: '',
  modpackVersion: '',
  fileApi: '',
  server: null,
  tags: [],
}
/**
 * Use the general info of the instance
 */
export function useInstance(path: Ref<string>, instances: Ref<Instance[]>) {
  const instance = computed(() => instances.value.find(i => i.path === path.value) ?? EMPTY_INSTANCE)
  const runtime = computed(() => instance.value.runtime)
  const name = computed(() => instance.value.name)
  const isServer = computed(() => instance.value.server !== null)
  const select = (p: string) => {
    path.value = p
  }

  return {
    instances,
    path,
    runtime,
    name,
    isServer,
    select,
    instance,
    refreshing: computed(() => false),
  }
}
