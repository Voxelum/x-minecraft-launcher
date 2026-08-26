import { injection } from '@/util/inject'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstance } from './instance'

export function useInstanceVersionServerInstall() {
  const { runtime, path } = injection(kInstance)
  const { installServer } = injection(kInstanceVersionInstall)
  async function install() {
    return installServer(runtime.value, path.value)
  }

  return {
    install,
  }
}
