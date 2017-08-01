import profile from './profile'

const getters = profile.getters

const mutations = Object.assign({
    setAuthor(states, author) {
        states.author = author
    },
    setDescription(states, description) {
        states.description = description
    },
}, profile.mutations)

const actions = {
    save(context, payload) {
        return context.state;
    },
    refresh(context, payload) {

    },
}

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

export default {
    state,
    getters,
    mutations,
    actions,
}
