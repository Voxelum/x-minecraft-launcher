import { useServiceOnly } from './useService'
import { ControllerChannel } from '/@shared/controller'
import { BaseServiceKey } from '/@shared/services/BaseService'

/**
 * Use native window control dialog
 */
export function useWindowController(): ControllerChannel {
  return controllerChannel
}

export function useQuit() {
  return useServiceOnly(BaseServiceKey, 'quit', 'exit')
}
