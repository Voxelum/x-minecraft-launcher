export default {
    namespaced: true,
    state: {
        dragover: false,
    },
    mutations: {
        dragover(states, value) {
            states.dragover = value
        },
    },
}
