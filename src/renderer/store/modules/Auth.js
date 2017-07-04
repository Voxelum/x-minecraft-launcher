const state = {
  modes: ['mojang', 'offline'],
  mode: 'mojang',
}
const getters = {
  modes: state => state.modes,
  disablePassword: state => state.mode == 'offline',
  mode: state => state.mode
}
const mutations = {
  select(mode) {
    if (state.modes.indexOf(mode) != -1)
      state.mode = mode
  },
  offline() {
    state.mode = offline
  }
}

const actions = {
}

export default {
  state,
  getters,
  mutations,
  actions
}
