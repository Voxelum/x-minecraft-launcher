import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: {
        id: '',
        allThemes: [],
        metas: {},
    },
    getters: {
        id: state => state.id,
        metas: state => state.metas,
        all: state => state.allThemes,
    },
    mutations: {
    },
    actions: {
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} theme 
         */
        updateTheme(context, theme) {

        },

        updateConfig(context, meta) {

        },
        /**
         * @param {ActionContext} context 
         */
        load(context, virtual) {
            // virtual.get('theme')
        },
    },
}
