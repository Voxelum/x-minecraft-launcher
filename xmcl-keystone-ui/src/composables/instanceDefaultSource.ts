import { InjectionKey, Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export const kInstanceDefaultSource: InjectionKey<Ref<'curseforge' | 'modrinth'>> = Symbol('InstanceDefaultSource')

export function useInstanceDefaultSource(path: Ref<string>): Ref<'curseforge' | 'modrinth'> {
  const defaultSource = useLocalStorage(computed(() => `instanceDefaultSource?instance=${path.value}`), 'modrinth', { writeDefaults: false })
  return defaultSource as Ref<'curseforge' | 'modrinth'>
}
