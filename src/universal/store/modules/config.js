import { ActionContext, Module } from 'vuex';
import { app } from 'electron';
import locales from 'locales';

export default {
    namespaced: true,
    state: {
        theme: 'semantic',
        themes: [],
        locale: '',
        locales: [],
        metaMap: {},
    },
    getters: {
        themeMeta: state => state.metaMap[state.theme],
    },
    mutations: {
        /**
         * @param {ConfigState} state 
         * @param {string} theme 
         */
        theme(state, theme) {
            state.theme = theme;
        },
        /**
         * @param {ConfigState} state 
         * @param {string[]} themes 
         */
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
            const data = await context.dispatch('read', { path: 'config.json', fallback: {}, type: 'json' }, { root: true });
            context.commit('theme', data.theme || 'semantic');
            if (data.locale) context.commit('locale', data.locale);
            else context.commit('locale', app.getLocale());
            context.commit('locales', Object.keys(locales));
        },
        save(context) {
            return context.dispatch('write', { path: 'config.json', data: JSON.stringify(context.state) }, { root: true });
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{theme?:string}} payload 
         */
        edit(context, payload) {
            if (payload.theme || payload.theme !== context.state.theme) {
                context.commit('theme', payload.theme);
            }
            if (payload.locale || payload.locale !== context.state.locale) {
                context.commit('locale', payload.locale);
            }
        },
    },
}; // as Module<ConfigState, any>
