import { TextComponent, TextFormatting, Style, ServerInfo, ServerStatus } from 'ts-minecraft'
import protocol from 'shared/protocol'
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
    ...profile.getters,
    errors(states) {
        // const err = profile.getters.errors(state)
        // this probably is a issue.... if i delegate to profile's getter; the responsive will fail.
        const errors = []
        if (states.minecraft.version === '' || states.minecraft.version === undefined || states.minecraft.version === null) errors.push('profile.empty.version')
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
        return JSON.stringify(context.state, (key, value) => {
            if (key === 'settings' || key === 'maps' || key === 'status') return undefined;
            return value;
        })
    },
    refresh(context, force) {
        if (context.state.status.pingToServer && !force) return Promise.resolve();
        context.commit('putAll', { status: ServerStatus.pinging() })
        if (context.state.host === undefined) return Promise.reject('server.host.empty')
        return context.dispatch('query', {
            service: 'servers',
            action: 'ping',
            payload: { host: context.state.host, port: context.state.port },
        }, { root: true })
            .then((frame) => {
                const status = ServerStatus.from(frame)
                status.pingToServer = frame.ping
                const all = {
                    icon: status.icon,
                    status,
                }
                const versions = protocol[status.protocolVersion]
                if (versions) context.commit('minecraft/version', versions[0]);
                context.commit('putAll', all)
                return status
            }, (err) => {
                if (err.code === 'ETIMEOUT') {
                    const timeout = TextComponent.str('server.status.timeout');
                    timeout.style = Style.create({ color: TextFormatting.RED })
                    context.commit('putAll', { status: new ServerStatus(TextComponent.str('version.unknown'), timeout, -1, -1, -1) })
                } else if (err.code === 'ECONNREFUSED') {
                    const nohost = TextComponent.str('server.status.nohost');
                    nohost.style = Style.create({ color: TextFormatting.RED })
                    context.commit('putAll', { status: new ServerStatus(TextComponent.str('version.unknown'), nohost, -1, -1, -1) })
                }
            })
    },
}
export default {
    namespaced: true,
    modules: { ...profile.modules },
    state,
    getters,
    mutations,
    actions,
}
