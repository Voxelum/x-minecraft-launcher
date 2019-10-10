import { remote, OpenDialogOptions, SaveDialogOptions } from "electron";

const dialog = {
    showOpenDialog(options: OpenDialogOptions) {
        return new Promise<{ filePaths: string[], bookmarks?: string[] }>((resolve, reject) => {
            remote.dialog.showOpenDialog(options, (filePaths, bookmarks) => {
                resolve({ filePaths: filePaths || [], bookmarks });
            })
        });
    },
    showSaveDialog(options: SaveDialogOptions) {
        return new Promise<{ filename?: string, bookmark?: string }>((resolve, reject) => {
            remote.dialog.showSaveDialog(options, (filename, bookmark) => {
                resolve({ filename, bookmark });
            })
        });
    }
}

export function useNativeDialog() {
    return dialog;
}
