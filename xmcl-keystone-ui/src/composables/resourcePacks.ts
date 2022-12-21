import { ResourceDomain } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useDomainResources } from './resources'

export const kResourcePacks: InjectionKey<ReturnType<typeof useResourcePacks>> = Symbol('kResourcePacks')

export function useResourcePacks() {
  return useDomainResources(ResourceDomain.ResourcePacks)
}
