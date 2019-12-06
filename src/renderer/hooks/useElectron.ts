import { inject } from '@vue/composition-api';
import { IPC_KEY, REMOTE_DIALOG_KEY, REMOTE_SHELL_KEY, ELECTRON_CLIPBOARD } from 'renderer/constant';
import { requireNonnull } from 'universal/utils/object';
import { Shell, IpcRenderer, Dialog, Clipboard } from 'electron';

/**
 * Use electron native dialog
 */
export function useNativeDialog(): Dialog {
    const dialog = inject(REMOTE_DIALOG_KEY);
    requireNonnull(dialog);
    return dialog;
}

/**
 * Use electron shell
 */
export function useShell(): Shell {
    const shell = inject(REMOTE_SHELL_KEY);
    requireNonnull(shell);
    return shell;
}

/**
 * Use electron ipc renderer
 */
export function useIpc(): IpcRenderer {
    const ipc = inject(IPC_KEY);
    requireNonnull(ipc);
    return ipc;
}

/**
 * Use electron clipboard
 */
export function useClipboard(): Clipboard {
    const board = inject(ELECTRON_CLIPBOARD);
    requireNonnull(board);
    return board;
}
