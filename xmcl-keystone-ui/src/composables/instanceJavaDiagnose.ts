import { injection } from '@/util/inject'
import { InjectionKey, Ref } from 'vue'
import { useLocalStorageCache } from './cache'
import { JavaCompatibleState, kInstanceJava } from './instanceJava'

export const kInstanceJavaDiagnose: InjectionKey<ReturnType<typeof useInstanceJavaDiagnose>> = Symbol('InstanceJavaDiagnose')

export function useInstanceJavaDiagnose({ status: java } = injection(kInstanceJava)) {
  const item: Ref<'invalid' | 'incompatible' | undefined> = computed(() => {
    const stat = java.value
    if (!stat) return undefined

    const key = stat.instance
    const isBypassed = stat.java && whiteList.value[key] === stat.java.path
    if (isBypassed) return undefined

    if (stat.javaPath) {
      if (!stat.java?.valid) {
        return 'invalid'
      }
      if ('compatible' in stat && stat.compatible !== JavaCompatibleState.Matched) {
        return 'incompatible'
      }
    }

    return undefined
  })

  const whiteList = useLocalStorageCache('instanceJavaBypass', () => ({}), JSON.stringify, JSON.parse)

  function bypass() {
    if (!item.value) return
    const current = java.value
    if (current?.java) {
      whiteList.value = { ...whiteList.value, [current.instance]: current.java.path }
    }
  }

  return {
    issue: item,
    bypass,
  }
}
