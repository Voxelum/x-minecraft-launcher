import { inject } from '@vue/composition-api'
import { Clipboard, Dialog, IpcRenderer } from 'electron'
import { useServiceOnly } from './useService'
import { ELECTRON_CLIPBOARD, IPC_KEY, REMOTE_DIALOG_KEY } from '/@/constant'
import { BaseServiceKey } from '/@shared/services/BaseService'
import { requireNonnull } from '/@shared/util/assert'

/**
 * Use electron native dialog
 */
export function useNativeDialog(): Dialog {
  const dialog = inject(REMOTE_DIALOG_KEY)
  requireNonnull(dialog)
  return dialog
}

/**
 * Use electron ipc renderer
 */
export function useIpc(): IpcRenderer {
  const ipc = inject(IPC_KEY)
  requireNonnull(ipc)
  return ipc as any
}

/**
 * Use electron clipboard
 */
export function useClipboard(): Clipboard {
  const board = inject(ELECTRON_CLIPBOARD)
  requireNonnull(board)
  return board
}

export function useQuit() {
  return useServiceOnly(BaseServiceKey, 'quit', 'exit')
}

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
}

export function useBrowserWindowOperation() {
  const ipc = useIpc()
  function show() {
    return ipc.invoke('control', Operation.Show)
  }
  function hide() {
    return ipc.invoke('control', Operation.Hide)
  }
  function minimize() {
    return ipc.invoke('control', Operation.Minimize)
  }
  function maximize() {
    return ipc.invoke('control', Operation.Maximize)
  }
  return {
    minimize,
    maximize,
    show,
    hide,
  }
}
