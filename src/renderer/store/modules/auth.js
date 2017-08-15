import Vue from 'vue'

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
    username: theState => (theState.authInfo ? theState.authInfo.selectedProfile.name : 'Steve'),
}

const mutations = {
    select(theState, mode) {
        if (theState.modes.indexOf(mode) !== -1) {
            theState.mode = mode
        }
    },
    record(theState, { // record the state history
        auth,
        account,
    }) {
        theState.authInfo = auth
        theState.clientToken = auth.clientToken
        theState.accessToken = auth.accessToken
        if (!theState.history[theState.mode]) Vue.set(theState.history, theState.mode, [])
        theState.history[theState.mode].push(account)
    },
}
const actions = {
    save(context, payload) {
        const { mutation } = payload;
        if (!mutation.endsWith('/record')) return Promise.resolve()
        const data = JSON.stringify(context.state, (key, value) => (key === 'modes' ? undefined : value))
        return context.dispatch('write', { path: 'auth.json', data }, { root: true })
    },
    load(context, payload) {
        return context.dispatch('read', { path: 'auth.json', fallback: {}, encoding: 'json' }, { root: true })
            .then(data => context.dispatch('query', { service: 'auth', action: 'modes' }, { root: true }).then(modes => [modes, data]))
            .then(([modes, data]) => {
                data.modes = modes
                return data
            })
    },
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
