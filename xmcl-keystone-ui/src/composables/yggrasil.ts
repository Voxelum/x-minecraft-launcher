import { UserServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey } from 'vue'
import { useService } from './service'

export const kSupportedAuthorityMetadata: InjectionKey<ReturnType<typeof useSupportedAuthority>> = Symbol('kSupportedAuthorityMetadata')

export function useSupportedAuthority() {
  const { getSupportedAuthorityMetadata } = useService(UserServiceKey)
  return useSWRV('supportedAuthority', getSupportedAuthorityMetadata)
}
