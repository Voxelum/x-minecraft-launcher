const {
    ServerInfo,
} = require('ts-minecraft')
const fs = require('fs')

export default {
    actions: {
        ping({ host, port }) {
            // TODO multi-protocol trial 
            return ServerInfo.fetchStatusFrame({ host, port }, { protocol: 335, timeout: 10000 })
        },
        fetchServerIcon(serverInfo) {

        },
    },
}
