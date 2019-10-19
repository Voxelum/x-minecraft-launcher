import { webContents, ipcMain } from 'electron';
import { MutationPayload, Store } from 'vuex';

export default function (store: Store<any>) {
    const mutationHistory: MutationPayload[] = [];
    ipcMain.on('vuex-dispatch', (event, { action, payload, option, id }) => {
        store.dispatch(action, payload, option).then((result) => {
            event.sender.send(`vuex-dispatch-${id}`, { result });
        }, (error) => {
            event.sender.send(`vuex-dispatch-${id}`, { error });
        });
    });
    ipcMain.on('vuex-sync', (event, currentId) => {
        console.log(`sync on renderer: ${currentId}, main: ${mutationHistory.length}`);
        if (currentId === mutationHistory.length) {
            return;
        }
        const mutations = mutationHistory.slice(currentId);
        event.sender.send('vuex-sync', mutations, mutationHistory.length);
    });
    store.subscribe((mutation, state) => {
        mutationHistory.push(mutation);
        const id = mutationHistory.length;
        webContents.getAllWebContents().forEach((w) => {
            w.send('vuex-commit', mutation, id);
        });
    });
};
