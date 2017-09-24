import { ServerInfo } from 'ts-minecraft'

const fs = require('fs')

export default {
    actions: {
        ping(payload) {
            if (!payload) return Promise.reject('Ping server has to have the host and port as the arguments!')
            const { host, port } = payload;
            // TODO multi-protocol trial 
            return ServerInfo.fetchStatusFrame({ host, port }, { protocol: 335, timeout: 10000 })
        },
        fetchServerIcon(serverInfo) {

        },
    },
}
