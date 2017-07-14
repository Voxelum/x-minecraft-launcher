import profile from './profile'

function state() {
    let state = profile.state()
    state.type = 'server'
    state.ip = ''
    state.motd = ''
    state.ping = ''
    state.icon = ''
    return state
}
const getters = {
    //Use mapState
}

const mutations = profile.mutations

const actions = {
    refresh(context, payload) {
        service.require('service')
        //TODO ping the server
    }
}
export default {
    state,
    getter,
    mutations,
    actions
}