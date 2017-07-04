const state = {
  modes: ['mojang', 'offline'],
  mode: 'mojang',
  authInfo: undefined
}
const getters = {
  modes: state => state.modes,
  disablePassword: state => state.mode == 'offline',
  mode: state => state.mode,
  info: state => state.authInfo
}

const mutations = {
  select(state, mode) {
    if (state.modes.indexOf(mode) != -1)
      state.mode = mode
  },
  offline() {
    state.mode = offline
  }
}
const actions = {
  login(context) {
    require('electron').remote.require('login').login(context.)

  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
