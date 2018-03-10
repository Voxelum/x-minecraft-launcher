import Vuex from 'vuex';
import { ipcMain, WebContents } from 'electron'

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
            event.sender.send('vuex-sync', mutations, mutations.length + currentId);
        })
        store.subscribe(
            /**
             * @param {{type: string}} mutation 
             */
            (mutation, state) => {
                if (store.getters.loading) return;
                const id = mutationHistory;
                mutationHistory.push(mutation);
                WebContents.getAllWebContents().forEach((w) => {
                    w.send('vuex-commit', mutation, id);
                })
            });
    }
