import { Server } from 'ts-minecraft'

export default {
    actions: {
        ping(context, payload) {
            if (!payload) return Promise.reject('Ping server has to have the host and port as the arguments!')
            const { host, port } = payload;
            // TODO multi-protocol trial 
            return Server.fetchStatusFrame({ host, port }, { protocol: 335 })
        },
    },
}
