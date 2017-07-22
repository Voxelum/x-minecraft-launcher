const state = {
    modes: ['mojang', 'offline'],
    mode: 'mojang',
    history: {},
    accessToken: '',
    clientToken: '',
    authInfo: undefined, // cached
}
const getters = {
    modes: theState => theState.modes,
    disablePassword: theState => theState.mode === 'offline',
    mode: theState => theState.mode,
    info: theState => theState.authInfo || {},
}

const mutations = {
    select(theState, mode) {
        if (theState.modes.indexOf(mode) !== -1) {
            console.log(`change mode ${mode}`)
            theState.mode = mode
        }
    },
    offline() {
        state.mode = 'offline'
    },
    record(theState, { // record the state history
        auth,
        account,
    }) {
        theState.authInfo = auth
        theState.clientToken = auth.clientToken
        theState.accessToken = auth.accessToken
        if (!theState.history[theState.mode]) theState.history[theState.mode] = []
        theState.history[theState.mode].push(account)
    },
}
const actions = {
    login(context, payload) {
        return context.dispatch('query', { service: 'auth', action: 'login', payload }, { root: true })
            .then((result) => {
                context.commit('record', {
                    auth: result,
                    account: payload.account,
                })
                return result
            })
    },
}

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
