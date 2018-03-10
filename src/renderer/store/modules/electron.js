import { remote } from 'electron'

export default {
    actions: {
        // exit() { ipcRenderer.sendSync('exit') },
        /**
         * 
         * @param {ActionContext} context 
         * @param {} payload 
         * @return {Promise<string[]>}
         */
        openDialog(context, payload) {
            return new Promise((resolve, reject) => {
                remote.dialog.showOpenDialog(
                    remote.BrowserWindow.getFocusedWindow(),
                    payload,
                    (files) => {
                        files = files || [];
                        resolve(files)
                    })
            });
        },
        saveDialog(context, payload) {
            return new Promise((resolve, reject) => {
                remote.dialog.showSaveDialog(
                    remote.BrowserWindow.getFocusedWindow(),
                    payload,
                    (file) => {
                        file = file || '';
                        resolve(file)
                    })
            })
        },
        updateTheme() {
            // ipcRenderer.send('update', payload.location, payload.theme)
        },
    },
}
