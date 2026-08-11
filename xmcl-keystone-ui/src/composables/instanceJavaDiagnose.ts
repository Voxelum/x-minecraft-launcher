import { injection } from '@/util/inject'
import { InjectionKey, Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { InstanceJavaStatus, JavaCompatibleState, kInstanceJava } from './instanceJava'

export const kInstanceJavaDiagnose: InjectionKey<ReturnType<typeof useInstanceJavaDiagnose>> = Symbol('InstanceJavaDiagnose')
export type InstanceJavaIssue = 'invalid' | 'incompatible' | 'missing'

export function getInstanceJavaIssue(stat: InstanceJavaStatus | undefined, bypassedPath?: string): InstanceJavaIssue | undefined {
  if (!stat) return undefined

  const isBypassed = stat.java && bypassedPath === stat.java.path
  if (isBypassed) return undefined

  if (stat.javaPath) {
    if (!stat.java?.valid) {
      return 'invalid'
    }
    if ('compatible' in stat && stat.compatible !== JavaCompatibleState.Matched) {
      return 'incompatible'
    }
  }

  if (!stat.java) {
    return 'missing'
  }

  return undefined
}

export function useInstanceJavaDiagnose({ status: java } = injection(kInstanceJava)) {
  const item: Ref<InstanceJavaIssue | undefined> = computed(() => {
    const stat = java.value
    return getInstanceJavaIssue(stat, stat ? whiteList.value[stat.instance] : undefined)
  })

  const whiteList = useLocalStorage<Record<string, string>>('instanceJavaBypass', {}, { deep: false, writeDefaults: false })

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
