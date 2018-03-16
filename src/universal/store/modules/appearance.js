import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: {
        theme: 'semantic',
        metas: {},
        allThemes: [],
    },
    getters: {
        theme: state => state.theme,
        themeMeta: state => state.metas[state.theme],
        allThemeMetas: state => state.metas,
        themes: state => state.allThemes,
    },
    mutations: {
        theme(state, theme) {
            state.theme = theme;
        },
        themes(state, themes) {

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
        updateSetting(context, payload) {
            if (payload.theme) {
                if (payload.theme !== context.state.theme) {
                    context.commit('setTheme', payload.theme)
                }
            }
            // if (payload.defaultResolution) {
            //     context.commit('setDefaultResolution', payload.defaultResolution);
            // }
        },
    },
}
