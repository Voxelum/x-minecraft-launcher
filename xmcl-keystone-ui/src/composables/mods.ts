import { ResourceDomain } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useDomainResources } from './resources'

export const kMods: InjectionKey<ReturnType<typeof useMods>> = Symbol('Mods')

export function useMods() {
  return useDomainResources(ResourceDomain.Mods)
}
