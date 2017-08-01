import { TextComponent, ServerInfo, ServerStatus } from 'ts-minecraft'
import '../../../shared/protocol'
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
                const versions = profile[status.protocolVersion]
                if (versions) all.versoin = versions[0]
                console.log(all)
                context.commit('putAll', all)
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
