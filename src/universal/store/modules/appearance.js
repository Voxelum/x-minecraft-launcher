import { ActionContext } from 'vuex'

export default {
    state: {
        theme: '',
        metas: {},
        allThemes: [],
        defaultResolution: { width: 400, height: 400, fullscreen: false },
    },
    getters: {
        theme: state => state.theme,
        themeMeta: state => state.metas[state.theme],
        allThemeMetas: state => state.metas,
        allThemes: state => state.allThemes,
        defaultResolution: state => state.defaultResolution,
    },
    mutations: {
        setTheme(state, theme) {
            state.theme = theme;
        },
        setDefaultResolution(state, resolution) {
            state.defaultResolution.width = resolution.width;
            state.defaultResolution.height = resolution.height;
            state.defaultResolution.fullscreen = resolution.fullscreen;
        },
    },
    actions: {
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
            if (payload.defaultResolution) {
                context.commit('setDefaultResolution', payload.defaultResolution);
            }
        },
        /**
         * @param {ActionContext} context 
         */
        load(context, virtual) {
        },
    },
}
