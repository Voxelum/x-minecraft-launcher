import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: {
        theme: 'semantic',
        metas: {},
        allThemes: [],
    },
    getters: {
        themeMeta: state => state.metas[state.theme],
    },
    mutations: {
        theme(state, theme) {
            state.theme = theme;
        },
        themes(state, themes) {
            state.allThemes = themes; 
        },
    },
    actions: {
        async load(context) {
            const data = await context.dispatch('read', { path: 'appearance.json', fallback: {} }, { root: true });
            context.commit('theme', data.theme || 'semantic');
        },
        save(context) {
            return context.dispatch('write', { path: 'appearance.json', data: JSON.stringify(context.state) }, { root: true })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{theme?:string}} payload 
         */
        edit(context, payload) {
            if (payload.theme) {
                if (payload.theme !== context.state.theme) {
                    context.commit('setTheme', payload.theme)
                }
            }
        },
    },
}
