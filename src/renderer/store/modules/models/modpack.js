import profile from './profile'

function state() {
    let state = profile.state()
    state.author = ''
    state.description = ''
    state.url = ''
    state.icon = ''
    return state
}

const getters = profile.getters

const mutations = profile.mutations

const actions = {

}

export default {
    state,
    getter,
    mutations,
    actions
}