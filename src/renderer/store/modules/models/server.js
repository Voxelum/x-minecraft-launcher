import { TextComponent, ServerInfo } from 'ts-minecraft'

import profile from './profile'

function state() {
    const theState = profile.state()

    theState.type = 'server'
    theState.host = ''
    theState.port = ''
    theState.isLanServer = false
    theState.icon = ''
    theState.status = {}
    return theState
}
/* eslint-disable no-unused-vars */
const getters = {
    // Use mapState
}

const mutations = profile.mutations

const actions = {
    save(context) {
        const saved = Object.assign({}, context.state);
        saved.status = undefined;
        return saved;
    },
    ping(context, payload) {
        return context.dispatch('query', {
            service: 'servers',
            action: 'ping',
            payload: { host: context.state.host, port: context.state.port },
        }, { root: true })
            .then((frame) => {
                const status = ServerInfo.parseFrame(frame)
                status.pingToServer = frame.ping
                context.commit('putAll', {
                    icon: status.icon,
                    status,
                })
                console.log(status)
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
