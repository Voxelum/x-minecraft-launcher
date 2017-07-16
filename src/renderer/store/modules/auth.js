import {
    ipcRenderer,
} from 'electron'

import launcher from '../../launcher'

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
    login(context, loginInfo) {
        return launcher.query('auth', 'login', loginInfo).then((result) => {
            context.commit('record', {
                auth: result.auth,
                account: loginInfo[0],
            })
        });
    },
}

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
