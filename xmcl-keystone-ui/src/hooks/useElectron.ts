import { BaseServiceKey, ControllerChannel } from '@xmcl/runtime-api'
import { useServiceOnly } from './useService'

/**
 * Use native window control dialog
 */
export function useWindowController(): ControllerChannel {
  return controllerChannel
}

export function useQuit() {
  return useServiceOnly(BaseServiceKey, 'quit', 'exit')
}
