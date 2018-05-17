import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: {
        theme: 'semantic',
        metas: {},
        themes: [],
        locale: '',
        locales: [],
    },
    getters: {
        themeMeta: state => state.metas[state.theme],
    },
    mutations: {
        theme(state, theme) {
            state.theme = theme;
        },
        themes(state, themes) {
            state.themes = themes;
        },
        locale(state, language) {
            state.locale = language;
        },
        locales(state, languages) {
            state.locales = languages;
        },
    },
    actions: {
        async load(context) {
            const data = await context.dispatch('read', { path: 'config.json', fallback: {} }, { root: true });
            context.commit('theme', data.theme || 'semantic');
            if (data.locale) context.commit('locale', data.locale);
        },
        save(context) {
            return context.dispatch('write', { path: 'config.json', data: JSON.stringify(context.state) }, { root: true })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{theme?:string}} payload 
         */
        edit(context, payload) {
            if (payload.theme || payload.theme !== context.state.theme) {
                context.commit('theme', payload.theme)
            }
            if (payload.locale || payload.locale !== context.state.locale) {
                context.commit('locale', payload.locale)
            }
        },
    },
}
