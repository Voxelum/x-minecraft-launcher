import Vue from 'vue'

export default {
    state: () => ({
        mods: [],
        version: '',
        settings: {},
    }),
    getters: {
        forgeMods: state => state.mods,
        forgeVersion: state => state.version,
        settings: state => state.settings,
    },
    mutations: {
        forgeVersion(state, version) { state.version = version },
        addForgeMod(state, mod) {
            state.mods.push(mod);
        },
        removeForgeMod(state, mod) {
            Vue.delete(state.mods, state.mods.indexOf(mod));
        },
    },
    actions: {
        load() { },
        setForgeVersion(context, version) {
            if (context.state.version !== version) {
                context.commit('forgeVersion', version)
            }
        },
        addForgeMod(context, mod) {
            if (context.state.mods.indexOf(mod) === -1) {
                context.commit('addForgeMod', mod)
            }
        },
        removeForgeMod(context, mod) {
            context.commit('removeForgeMod', mod)
        },
    },
}
