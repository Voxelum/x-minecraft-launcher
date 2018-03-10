import { TextComponent, TextFormatting, Style, Server } from 'ts-minecraft'
import vuex from 'vuex'

// import protocol from 'universal/protocol'

export default {
    state: () => ({
        type: 'server',
        host: '',
        port: 25565,
        isLanServer: false,
        icon: '',
        status: {},
    }),
    getters: {
        host: state => state.host,
        port: state => state.port,
        icon: state => state.icon,
        status: state => state.status,
        isLanServer: state => state.isLanServer,
        errors(state) {
            const errors = []
            const isNone = obj => obj === '' || obj === undefined || obj == null;
            if (isNone(state.mcversion)) errors.push('profile.noversion')
            if (isNone(state.java)) errors.push('profile.nojava')
            if (isNone(state.host)) errors.push('profile.nohost')
            return errors;
        },
    },
    actions: {
        serialize(context, payload) {
            return JSON.stringify(context.state, (key, value) => {
                if (key === 'settings' || key === 'maps' || key === 'status') return undefined;
                return value;
            })
        },
        /**
         * 
         * @param {vuex.ActionContext} context 
         * @param {*} force 
         */
        refresh(context, force) {
            if (context.state.status.pingToServer && !force) return Promise.resolve();
            context.commit('profile', { status: Server.Status.pinging() })
            if (context.state.host === undefined) return Promise.reject('server.host.empty')
            return Server.fetchStatusFrame({
                host: context.state.host,
                port: context.state.port
            }, { protocol: 335 })
                .then((frame) => {
                    const status = Server.Status.from(frame)
                    status.pingToServer = frame.ping
                    const all = {
                        icon: status.icon,
                        status,
                    }
                    const versions = []; protocol[status.protocolVersion]
                    if (versions) context.commit('profile', { mcversion: versions[0] });
                    context.commit('profile', all)
                    return status;
                }, (err) => {
                    console.error(err);
                    if (err.code === 'ETIMEOUT') {
                        const timeout = TextComponent.str('server.status.timeout');
                        timeout.style = Style.create({ color: TextFormatting.RED })
                        context.commit('profile', { status: new Server.Status(TextComponent.str('version.unknown'), timeout, -1, -1, -1) })
                    } else if (err.code === 'ENOTFOUND') {
                        const timeout = TextComponent.str('server.status.nohost');
                        timeout.style = Style.create({ color: TextFormatting.RED })
                        context.commit('profile', { status: new Server.Status(TextComponent.str('version.unknown'), timeout, -1, -1, -1) })
                    } else if (err.code === 'ECONNREFUSED') {
                        const nohost = TextComponent.str('server.status.refuse');
                        nohost.style = Style.create({ color: TextFormatting.RED })
                        context.commit('profile', { status: new Server.Status(TextComponent.str('version.unknown'), nohost, -1, -1, -1) })
                    } else {
                        context.commit('profile', { status: new Server.Status(TextComponent.str('version.unknown'), 'Internet Error', -1, -1, -1) })
                    }
                })
        },
    },
}
