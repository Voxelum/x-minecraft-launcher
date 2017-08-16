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

const getters = {
    ...profile.getters,

}

const mutations = Object.assign({}, profile.mutations)

const actions = {
    serialize(context, payload) {
        return JSON.stringify(context.state, (key, value) => {
            if (key === 'settings' || key === 'maps') return undefined;
            return value;
        })
    },
    refresh(context, payload) { },
}

export default {
    namespaced: true,
    modules: { ...profile.modules },
    state,
    getters,
    mutations,
    actions,
}
