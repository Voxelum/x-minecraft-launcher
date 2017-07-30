import profile from './profile'

function state() {
    const theState = profile.state()

    theState.type = 'server'
    theState.host = ''
    theState.port = ''
    theState.isLanServer = false
    theState.status = {}
    theState.icon = ''
    return theState
}
/* eslint-disable no-unused-vars */
const getters = {
    // Use mapState
}

const mutations = profile.mutations

const actions = {
    ping(context, payload) {
        context.dispatch('query', {
            service: 'servers',
            action: 'ping',
            payload: { host: context.state.host, port: context.state.port },
        }, { root: true })
            .then((status) => {
                context.commit('putAll', {
                    status,
                    icon: status.icon,
                })
                console.log(context.state)
            })
    },
}
export default {
    state,
    getters,
    mutations,
    actions,
}
