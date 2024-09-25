import { injection } from '@/util/inject'
import { Ref } from 'vue'
import { JavaCompatibleState, kInstanceJava } from './instanceJava'

export function useInstanceJavaDiagnose() {
  const { status: java } = injection(kInstanceJava)
  const item: Ref<'invalid' | 'incompatible' | undefined> = computed(() => {
    const stat = java.value
    if (!stat) return undefined

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

  return {
    issue: item,
  }
}
