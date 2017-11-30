import { ActionContext } from 'vuex'

export default {
    state: {
        id: '',
        metas: {},
        allThemes: [],
        defaultResolution: { width: 400, height: 400, fullscreen: false },
    },
    getters: {
        // theme: state => state.id,
        // themeMeta: state => state.metas[state.id],
        allThemeMetas: state => state.metas,
        allThemes: state => state.allThemes,
        defaultResolution: state => state.defaultResolution,
    },
    mutations: {
        setTheme(state, theme) {
            state.id = theme;
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
        },
        /**
         * @param {ActionContext} context 
         */
        load(context, virtual) {
            // virtual.get('theme')
        },
    },
}
