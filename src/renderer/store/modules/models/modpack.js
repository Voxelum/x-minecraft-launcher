import profile from './profile'

function state() {
    const theState = profile.state()
    theState.author = ''
    theState.description = ''
    theState.url = ''
    theState.icon = ''
    return theState
}

const getters = profile.getters

const mutations = profile.mutations

const actions = {

}

export default {
    state,
    getters,
    mutations,
    actions,
}
