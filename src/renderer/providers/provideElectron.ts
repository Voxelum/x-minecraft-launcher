import { provide } from '@vue/composition-api'
import { clipboard, dialog, ELECTRON_CLIPBOARD, ipcRenderer, IPC_KEY, REMOTE_DIALOG_KEY } from '/@/constant'

export default function provideElectron () {
  provide(REMOTE_DIALOG_KEY, dialog)
  provide(IPC_KEY, ipcRenderer)
  provide(ELECTRON_CLIPBOARD, clipboard)
}
