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
    save(context) {
        const saved = Object.assign({}, context.state);
        saved.status = undefined;
        return saved;
    },
    refresh(context, payload) {
        context.commit('putAll', { status: ServerStatus.pinging() })
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
                console.log('@server')
                context.commit('putAll', all)
                console.log(context.state)
                return status
            }, (err) => {
                if (err.code === 'ETIMEOUT') {
                    context.commit('putAll', { status: ServerStatus.error() })
                }
            })
    },
}
export default {
    state,
    getters,
    mutations,
    actions,
}
