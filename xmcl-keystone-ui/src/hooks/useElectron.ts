import { BaseServiceKey, WindowController } from '@xmcl/runtime-api'
import { useServiceOnly } from './useService'

export function useQuit() {
  return useServiceOnly(BaseServiceKey, 'quit', 'exit')
}
