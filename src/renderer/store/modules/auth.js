import {
    ipcRenderer,
} from 'electron'

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
    record(theState, {
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
        return new Promise((resolve, reject) => {
            ipcRenderer.send('login', loginInfo)
            ipcRenderer.once('login', (event, error, auth) => {
                if (error) reject(error)
                else {
                    context.commit('record', {
                        auth,
                        account: loginInfo[0],
                    }) // TODO check this
                    resolve(auth)
                }
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
