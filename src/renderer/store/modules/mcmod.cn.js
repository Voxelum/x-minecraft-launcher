import vuex from 'vuex'

export default {
    namespaced: true,
    actions: {
        /**
         * 
         * @param {vuex.ActionContext} context 
         */
        viewRandom(context) {
            return context.dispatch('query', {
                service: 'mcmod',
                action: 'fetchRandom',
            }, { root: true })
        },
        /**
         * 
         * @param {vuex.ActionContext} context 
         */
        view(context) {
            return context.dispatch('query', {
                service: 'mcmod',
                action: 'fetchAll',
            }, { root: true })
        },
        /**
         * 
         * @param {vuex.ActionContext} context 
         */
        detail(context, id) {
            return context.dispatch('query', {
                service: 'mcmod',
                action: 'fetchDetail',
                payload: `http://www.mcmod.cn/class/${id}.html`,
            }, { root: true })
        },
    },
}
