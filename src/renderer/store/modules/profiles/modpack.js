import profile from './profile'

function state() {
    const theState = profile.state()
    theState.type = 'modpack'
    theState.ediable = true
    theState.author = ''
    theState.description = ''
    theState.url = ''
    theState.icon = ''
    return theState
}

const getters = profile.getters

const mutations = Object.assign({}, profile.mutations)

const actions = {
    serialize(context, payload) {
        return Object.assign({}, this.context)
    },
    refresh(context, payload) { },
    ...profile.actions,
}

export default {
    state,
    getters,
    mutations,
    actions,
}
