import { YggdrasilServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey } from 'vue'
import { useService } from './service'

export const kYggdrasilServices: InjectionKey<ReturnType<typeof useYggdrasilServices>> = Symbol('YggdrasilServices')

export function useYggdrasilServices() {
  const { getYggdrasilServices } = useService(YggdrasilServiceKey)
  return useSWRV('yggrassilServices', getYggdrasilServices)
}
