export default {
    namespaced: true,
    state() {
        return {
            version: '',
            settings: {},
        }
    },
    mutations: {
        liteloaderVersion(state, version) { state.version = version },
        update$reload(states, payload) {

        },
    },
    actions: {
        load() { },
    },
}
