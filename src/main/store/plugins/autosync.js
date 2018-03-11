import Vuex from 'vuex';
import { ipcMain, webContents } from 'electron'

const mutationHistory = [];

export default
    /**
     * @param {Vuex.Store<any>} store
     */
    (store) => {
        ipcMain.on('vuex-sync', (event, currentId) => {
            if (currentId === mutationHistory.length - 1) {
                return;
            }
            const mutations = mutationHistory.slice(currentId);
            event.sender.send('vuex-sync', mutations, mutationHistory.length);
        })
        store.subscribe(
            /**
             * @param {{type: string}} mutation 
             */
            (mutation, state) => {
                mutationHistory.push(mutation);
                const id = mutationHistory.length;
                webContents.getAllWebContents().forEach((w) => {
                    w.send('vuex-commit', mutation, id);
                })
            });
    }
