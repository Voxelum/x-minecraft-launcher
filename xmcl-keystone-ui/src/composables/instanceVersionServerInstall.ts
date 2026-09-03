import { injection } from '@/util/inject'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstance } from './instance'
import type { RendererActionScope } from '@/rendererAction'

export function useInstanceVersionServerInstall() {
  const { runtime, path } = injection(kInstance)
  const { installServer } = injection(kInstanceVersionInstall)
  async function install(action?: RendererActionScope) {
    return installServer(runtime.value, path.value, action)
  }

  return {
    install,
  }
}
