export default {
    namespaced: true,
    state() {
        return {
            enabled: false,
            version: '',
            settings: {},
        }
    },
    mutations: {
        toggle(state) { state.enabled = !state.enabled },
        version(state, version) { state.version = version },
        update$reload(states, payload) {
            
        },
    },
    actions: {
        load() { },
    },
}
