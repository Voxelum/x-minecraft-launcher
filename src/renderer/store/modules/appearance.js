import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: {
        theme: '',
        metas: {},
        themes: [],
        defaultResolution: { width: 400, height: 400, fullscreen: false },
    },
    getters: {
        theme: state => state.theme,
        themeMeta: state => state.metas[state.theme],
        themes: state => state.themes,
        defaultResolution: state => state.defaultResolution,
    },
    mutations: {
        setTheme(state, theme) {
            if (typeof theme !== 'string') return;
            if (theme !== state.theme) state.theme = theme;
            if (!state.metas[theme]) state.metas[theme] = {};
        },
        setMetas(state, metas) {
            if (typeof metas !== 'object') return;
            for (const key of Object.keys(metas)) {
                if (typeof metas[key] === 'object') {
                    state.metas[key] = JSON.parse(JSON.stringify(metas[key]));
                }
            }
        },
        setMeta(state, keyValPair) {
            if (typeof keyValPair !== 'object') return;
            const { key, value } = keyValPair;
            if (typeof key !== 'string') throw new Error('Meta key has to be string!');
            state.metas[state.theme][key] = value;
        },
        setDefaultResolution(state, resolution) {
            if (typeof resolution !== 'object') throw new Error('Resolution has to be object!')
            if (typeof resolution.width === 'number') {
                state.defaultResolution.width = resolution.width;
            }
            if (typeof resolution.height === 'number') {
                state.defaultResolution.height = resolution.height;
            }
            if (typeof resolution.fullscreen === 'boolean') {
                state.defaultResolution.fullscreen = resolution.fullscreen;
            }
        },
    },
    actions: {
        /**
         * 
         * @param {ActionContext} context 
         * @param {{theme?:string}} payload 
         */
        update(context, payload) {
            if (payload.theme) {
                context.commit('setTheme', payload.theme)
            }
            if (payload.defaultResolution) {
                context.commit('setDefaultResolution', payload.defaultResolution);
            }
        },
        /**
         * @param {ActionContext} context 
         */
        save(context) {
            const data = {
                ...context.state,
            }
            delete data.metas;
            return context.dispatch('write', {
                path: 'appearances.json',
                data,
            }, { root: true })
        },
        /**
         * @param {ActionContext} context 
         */
        async load(context) {
            const data = await context.dispatch('read', {
                path: 'appearances.json',
                fallback: {
                    theme: 'semantic',
                    metas: {},
                    defaultResolution: { width: 400, height: 400, fullscreen: false },
                },
                type: 'json',
            }, { root: true });
            context.commit('setTheme', data.theme);
            context.commit('setDefaultResolution', data.defaultResolution);
            context.commit('setMetas', data.metas);
        },
    },
}
