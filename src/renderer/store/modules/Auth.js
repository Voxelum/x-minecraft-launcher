const state = {
  modes: ['mojang', 'offline'],
  mode: 'mojang',
  history: {},
  accessToken: '',
  clientToken: '',
  authInfo: undefined //cached
}
const getters = {
  modes: state => state.modes,
  disablePassword: state => state.mode == 'offline',
  mode: state => state.mode,
  info: state => state.authInfo || {}
}

const mutations = {
  select(state, mode) {
    if (state.modes.indexOf(mode) != -1)
      state.mode = mode
  },
  offline() {
    state.mode = 'offline'
  },
  record(state, auth, loginAccount) {
    state.authInfo = auth
    state.clientToken = auth.clientToken
    state.accessToken = auth.accessToken
    if (!state.history[state.mode]) state.history[state.mode] = []
    state.history[state.mode].push(loginAccount)
  }
}
import { ipcRenderer } from 'electron'
const actions = {
  login(context, loginInfo) {
    return new Promise((resolve, reject) => {
      ipcRenderer.send('login', loginInfo)
      ipcRenderer.once('login', (event, error, auth) => {
        if (error) reject(error)
        else {
          context.record(auth, loginInfo[0])//TODO check this
          resolve(auth)
        }
      })
    });
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
