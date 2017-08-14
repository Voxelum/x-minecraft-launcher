import { ipcRenderer } from 'electron'

ipcRenderer.on('will-download', ({ file, url }) => {

})
ipcRenderer.on('download', ({ file, url, state, byte, total }) => {

})
ipcRenderer.on('download-done', ({ file, url, state, byte, total }) => {

})

export default {
    namespaced: true,
    state: {
        downloading: [],
        tasks: [],
    },
    mutations: {
        addTask(state, payload) {
            // console.log('@addTask')
            // console.log(payload)
        },
        deleteTask(state, payload) {
            // console.log('@deleteTask')
            // console.log(payload)
        },
    },

}
