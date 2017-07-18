import profile from './profile'

const getters = profile.getters

const mutations = profile.mutations

const actions = {

}

function state() {
    const theState = profile.state()
    theState.type = 'modpack'
    theState.author = ''
    theState.description = ''
    theState.url = ''
    theState.icon = ''
    return theState
}

export default {
    state,
    getters,
    mutations,
    actions,
}
