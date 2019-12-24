import { inject } from '@vue/composition-api';
import { Clipboard, Dialog, IpcRenderer } from 'electron';
import { ELECTRON_CLIPBOARD, IPC_KEY, REMOTE_DIALOG_KEY } from 'renderer/constant';
import { requireNonnull } from 'universal/utils/object';
import { useStore } from './useStore';

/**
 * Use electron native dialog
 */
export function useNativeDialog(): Dialog {
    const dialog = inject(REMOTE_DIALOG_KEY);
    requireNonnull(dialog);
    return dialog;
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

export function useQuit() {
    const { services } = useStore();
    return {
        quit: services.BaseService.quit,
        exit: services.BaseService.exit,
    };
}
