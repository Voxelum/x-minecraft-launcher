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
    save(context, payload) {
        const { mutation } = payload;
        if (!mutation.endsWith('/record')) return Promise.resolve()
        const target = Object.assign({}, context.state)
        target.modes = undefined
        return context.dispatch('writeFile', { path: 'auth.json', data: JSON.stringify(target) }, { root: true })
    },
    load(context, payload) {
        console.log('load action of auth!')
        return context.dispatch('readFile', { path: 'auth.json', fallback: {}, encoding: 'json' }, { root: true })
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
