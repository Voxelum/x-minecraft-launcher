import { InjectionKey, Ref } from 'vue'
import { useLocalStorageCacheRef } from './cache'

export const kInstanceDefaultSource: InjectionKey<Ref<'curseforge' | 'modrinth'>> = Symbol('InstanceDefaultSource')

export function useInstanceDefaultSource(path: Ref<string>): Ref<string> {
  const defaultSource = useLocalStorageCacheRef(computed(() => `instanceDefaultSource?instance=${path.value}`), () => 'curseforge', s => s, s => s)
  return defaultSource
}
