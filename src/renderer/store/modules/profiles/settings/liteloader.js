export default {
    namespaced: true,
    state() {
        return {
            version: '',
            settings: {},
        }
    },
    mutations: {
        version(state, version) { state.version = version },
        update$reload(states, payload) {

        },
    },
    actions: {
        load() { },
    },
}
