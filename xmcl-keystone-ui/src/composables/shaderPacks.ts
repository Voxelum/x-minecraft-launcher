import { ResourceDomain } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useDomainResources } from './resources'

export const kShaderPacks: InjectionKey<ReturnType<typeof useShaderPacks>> = Symbol('kShaderPacks')

export function useShaderPacks() {
  return useDomainResources(ResourceDomain.ShaderPacks)
}
