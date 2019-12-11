import { provide } from '@vue/composition-api';
import { clipboard, dialog, ELECTRON_CLIPBOARD, ipcRenderer, IPC_KEY, REMOTE_DIALOG_KEY, REMOTE_SHELL_KEY, shell } from 'renderer/constant';


export default function provideElectron() {
    provide(REMOTE_SHELL_KEY, shell);
    provide(REMOTE_DIALOG_KEY, dialog);
    provide(IPC_KEY, ipcRenderer);
    provide(ELECTRON_CLIPBOARD, clipboard);
}
