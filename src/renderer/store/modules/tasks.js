import { ipcRenderer } from 'electron'
import Vue from 'vue'

ipcRenderer.on('will-download', ({ file, url }) => {

})
ipcRenderer.on('download', ({ file, url, state, byte, total }) => {

})
ipcRenderer.on('download-done', ({ file, url, state, byte, total }) => {

})

export default {
    namespaced: true,
    state: {
        tasks: {},
        failed: [],
    },
    mutations: {
        add(state, task) {
            Vue.set(state.tasks, task.id, task);
        },
        update(states, { id, progress, state }) {
            states.tasks[id].progress = progress;
            if (state) states.tasks[id].state = state;
        },
        child(state, { id, }) {

        },
        delete(state, id) {
            Vue.delete(state.tasks, id)
        },
        error(state, { error, id }) {
            // state.tasks[id]
            state.failed.push(task)
        },
    },
    actions: {
        addTask(context, payload) {
            const id = payload.id;
            const total = payload.total;

            payload.on('update', (progress, state) => {
                context.commit('update', { id, progress, state });
            })
            payload.on('finish', () => {
                context.commit('delete', id);
            })
            payload.on('error', (error) => {
                context.commit('error', { error, id })
            })
            context.commit('add', {
                id,
                progress: 0,
                state: 'prepare',
                total,
            });
        }
    }

}
