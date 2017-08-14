export default {
    namespaced: true,
    state() {
        return {
            enabled: false,
            mods: [],
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
    getters: {
        mods: state => state.mods,
    },
    actions: {
        load() { },
    },
}
