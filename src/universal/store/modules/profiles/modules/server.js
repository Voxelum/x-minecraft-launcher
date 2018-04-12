import { TextComponent, TextFormatting, Style, Server, NBT } from 'ts-minecraft'

export default {
    namespaced: true,
    state: () => ({
        servers: [],
        primary: -1,

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
        servers: state => state.servers,
        error(state) {
            const errors = [];
            if (!state.host) {
                errors.push('server.error.missingHost')
            }
            return errors;
        },
    },
    mutations: {
        add(state, server) {
            state.servers.push(server);
        },
        edit(state, option) {
            state.host = option.host || state.host;
            state.port = option.port || state.port;
            state.isLanServer = option.isLanServer || state.isLanServer;
            state.icon = option.icon || state.icon;
        },
    },
    actions: {
        async load(context, { id }) {
            const nbt = await context.dispatch('read', { path: `profiles/${id}/servers.dat` }, { root: true })
            if (nbt) {
                Server.parseNBT(nbt).forEach(i => context.commit('add', i));
            }
        },
        save(context) {
        },
        /**
         * @param {Server.Info} payload
         */
        add(context, payload) {
            if (!payload.host) throw new Error('Cannot add server with missing host!');
            context.commit('add', payload);
        },
        error(context) {
            const state = context.state;
            const errors = []
            const isNone = obj => obj === '' || obj === undefined || obj == null;
            if (state.mcversion === '') errors.push('profile.noversion')
            if (state.java === '' || state.java === undefined || state.java === null) errors.push('profile.missingjava')
            if (isNone(state.mcversion)) errors.push('profile.noversion')
            if (isNone(state.java)) errors.push('profile.nojava')
            if (isNone(state.host)) errors.push('profile.nohost')
            return errors;
        },
        refresh(context, force) {
            if (context.state.status.pingToServer && !force) return Promise.resolve();
            context.commit('profile', { status: Server.Status.pinging() })
            if (context.state.host === undefined) return Promise.reject('server.host.empty')
            return Server.fetchStatusFrame({
                host: context.state.host,
                port: context.state.port,
            }, { protocol: 335 })
                .then((frame) => {
                    const status = Server.Status.from(frame)
                    status.pingToServer = frame.ping
                    const all = {
                        icon: status.icon,
                        status,
                    }
                    const versions = []; //protocol[status.protocolVersion]
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
        $refresh: {
            root: true,
            /**
             * 
             * @param {vuex.ActionContext} context 
             * @param {*} force 
             */
            handler(context, force) {
                if (!this.host) return;
                context.dispatch('refresh', force);
            },
        },
    },
}
