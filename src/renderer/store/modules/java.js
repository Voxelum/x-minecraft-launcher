
export default {
    state: {
        javas: [],
    },
    getters: {
        javas: state => state.javas,
        defaultJava: state =>
            (state.javas.length !== 0 ? state.javas[state.javas.length - 1] : undefined),
    },
    mutations: {
        javas(state, javas) {
            if (javas instanceof Array) state.javas = javas;
        },
    },
    actions: {
        addJavas(context, java) {
            context.commit('javas', context.getters.javas.concat(java))
        },
        removeJava(context, java) {
            console.log(java)
            const newarr = context.getters.javas.filter(j => j !== java);
            if (newarr.length !== context.getters.javas.length) {
                context.commit('javas', newarr)
            }
        },
        /**
         * scan local java locations and cache
         */
        updateJavas({ dispatch, commit }) {
            return dispatch('query', { service: 'jre', action: 'availbleJre' }, { root: true }).then((javas) => {
                commit('javas', javas);
                return javas;
            });
        },
        downloadJavas(context) {
            return context.dispatch('query', { service: 'jre', action: 'ensureJre' }, { root: true }).then((javas) => {
                context.commit('javas', javas);
                return javas;
            });
        },
    },
}
