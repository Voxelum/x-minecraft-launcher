import { TextComponent, ServerInfo } from 'ts-minecraft'

import profile from './profile'

function state() {
    const theState = profile.state()

    theState.type = 'server'
    theState.host = ''
    theState.port = ''
    theState.isLanServer = false
    theState.icon = ''
    return theState
}
/* eslint-disable no-unused-vars */
const getters = {
    // Use mapState
}

const mutations = profile.mutations

const actions = {
    save() {

    },
    load() { },
    ping(context, payload) {
        return context.dispatch('query', {
            service: 'servers',
            action: 'ping',
            payload: { host: context.state.host, port: context.state.port },
        }, { root: true })
            .then((frame) => {
                const status = ServerInfo.parseFrame(frame)
                context.commit('putAll', {
                    icon: status.icon,
                })
                console.log(status)
                status.pingToServer = frame.ping
                return status
            })
    },
}
export default {
    state,
    getters,
    mutations,
    actions,
}
