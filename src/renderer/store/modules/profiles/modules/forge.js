import Vue from 'vue'

export default {
    state: () => ({
        mods: [],
        version: '',
    }),
    getters: {
        forgeMods: state => state.mods,
        forgeVersion: state => state.version,
        settings: state => state.settings,
    },
    mutations: {
        forgeVersion(state, version) { state.version = version },
        addForgeMod(state, mod) {
            if (mod instanceof Array) {
                state.mods.push(...mod);
            } else { state.mods.push(mod); }
        },
        removeForgeMod(state, mod) {
            Vue.delete(state.mods, state.mods.indexOf(mod));
        },
        $reload(state, data) {
            if (data.mods) { state.mods = data.mods; }
            if (data.version) { state.version = data.version; }
        },
    },
    actions: {
        // async load(context, { id }) {
        //     const cfg = await context.dispatch('read', {
        //         path: `profiles/${id}/mods.json`,
        //         fallback: {},
        //         type: 'json',
        //     }, { root: true })
        //     context.commit('$reload', cfg);
        // },
        // save(context, { id }) {
        //     const path = `profiles/${id}/mods.json`
        //     return context.dispatch('write', { path, data: context.state }, { root: true })
        // },
        setForgeVersion(context, version) {
            if (context.state.version !== version) {
                context.commit('forgeVersion', version)
            }
        },
        validateForgeVersion(context) {
            if (context.state.version === '') {
                const mcver = context.getters.mcversion;
                const rec = context.rootGetters['forge/getRecommendedByMc'](mcver);
                if (!rec) throw new Error();
                context.commit('forgeVersion', rec.version)
            }
        },
        addForgeMod(context, mod) {
            // context.dispatch('validateForgeVersion')
            if (context.state.mods.indexOf(mod) === -1) {
                context.commit('addForgeMod', mod)
            }
        },
        removeForgeMod(context, mod) {
            context.commit('removeForgeMod', mod)
        },
    },
}
