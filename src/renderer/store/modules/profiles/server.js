import { TextComponent, ServerInfo, ServerStatus } from 'ts-minecraft'
import protocol from '../../../shared/protocol'
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
const getters = {
    errors(states) {
        // const err = profile.getters.errors(state)
        // this probably is a issue.... if i delegate to profile's getter; the responsive will fail.
        const errors = []
        if (states.version === '' || states.version === undefined || states.version === null) errors.push('profile.empty.version')
        if (states.java === '' || states.java === undefined || states.java === null) errors.push('profile.empty.java')
        if (states.host === '' || states.host === undefined || states.host === null) {
            errors.push('server.empty.host')
        }
        return errors;
    },
}

const mutations = profile.mutations

const actions = {
    serialize(context, payload) {
        const serialized = Object.assign({}, context.state)
        serialized.status = undefined
        console.log(context.state)
        return serialized
    },
    refresh(context, payload) {
        context.commit('putAll', { status: ServerStatus.pinging() })
        if (context.state.host === undefined) return Promise.reject('server.host.empty')
        return context.dispatch('query', {
            service: 'servers',
            action: 'ping',
            payload: { host: context.state.host, port: context.state.port },
        }, { root: true })
            .then((frame) => {
                const status = ServerInfo.parseFrame(frame)
                status.pingToServer = frame.ping
                const all = {
                    icon: status.icon,
                    status,
                }
                const versions = protocol[status.protocolVersion]
                if (versions) all.version = versions[0]
                context.commit('putAll', all)
                return status
            }, (err) => {
                if (err.code === 'ETIMEOUT') {
                    console.log('TIMEOUT!!!!!!')
                    context.commit('putAll', { status: ServerStatus.error() })
                }
            })
    },
}
export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
