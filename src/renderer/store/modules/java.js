/**
 * @type {Java.Module}
 */
const a = 0;

export default {
    state: {
        javas: [],
    },
    getters: {
        javas: state => state.javas,
        defaultJava: state => (state.javas.length !== 0 ? state.javas[0] : undefined),
    },
    mutations: {
        javas(state, javas) {
            if (javas instanceof Array) state.javas = javas;
        },
    },
    actions: {
        updateJavas({ dispatch, commit }) {
            return dispatch('query', { service: 'jre', action: 'availbleJre' }, { root: true }).then((javas) => {
                commit('javas', javas);
                return javas;
            })
        },
    },
}
