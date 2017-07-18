import profile from './profile'

function state() {
    const theState = profile.state()

    theState.type = 'server'
    theState.host = ''
    theState.port = ''
    theState.isLanServer = false
    theState.motd = ''
    theState.ping = ''
    theState.icon = ''
    return theState
}
/* eslint-disable no-unused-vars */
const getters = {
    // Use mapState
}

const mutations = profile.mutations

const actions = {
    /* eslint-disable no-unused-vars */
    refresh(context, payload) {
        /* eslint-disable no-undef */
        service.require('service')
        // TODO ping the server
    },
}
export default {
    state,
    getters,
    mutations,
    actions,
}
