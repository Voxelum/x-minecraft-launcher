import { provide } from '@vue/composition-api';
import { remote, ipcRenderer, clipboard } from 'electron';
import { REMOTE_SHELL_KEY, REMOTE_DIALOG_KEY, IPC_KEY, ELECTRON_CLIPBOARD } from 'renderer/constant';

export default function provideElectron() {
    provide(REMOTE_SHELL_KEY, remote.shell);
    provide(REMOTE_DIALOG_KEY, remote.dialog);
    provide(IPC_KEY, ipcRenderer);
    provide(ELECTRON_CLIPBOARD, clipboard);
}
