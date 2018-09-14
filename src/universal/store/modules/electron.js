import { dialog, BrowserWindow, ipcMain } from 'electron';

export default {
    actions: {
        exit() { ipcMain.emit('exit'); },
        /**
         * 
         * @param {ActionContext} context 
         * @param {} payload 
         * @return {Promise<string[]>}
         */
        openDialog(context, payload) {
            return new Promise((resolve, reject) => {
                dialog.showOpenDialog(
                    BrowserWindow.getFocusedWindow(),
                    payload,
                    (files) => {
                        files = files || [];
                        resolve(files);
                    });
            });
        },
        saveDialog(context, payload) {
            return new Promise((resolve, reject) => {
                dialog.showSaveDialog(
                    BrowserWindow.getFocusedWindow(),
                    payload,
                    (file) => {
                        file = file || '';
                        resolve(file);
                    });
            });
        },
    },
};
