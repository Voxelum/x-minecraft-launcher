import { Store } from 'vuex';
import { ipcMain, webContents } from 'electron'

export default
    /**
         * @param {Store} store
         */
    (store) => {
        store.subscribeAction(
            (action, state) => {
            })
    }
