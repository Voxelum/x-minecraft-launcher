const {
    ServerInfo,
} = require('ts-minecraft')
const fs = require('fs')

export default {
    actions: {
        ping({ host, port }) {
            // TODO multi-protocol trial 
            return ServerInfo.fetchServerStatusFrame({ host, port }, { protocol: 335 })
        },
        fetchServerIcon(serverInfo) {

        },
    },
}
