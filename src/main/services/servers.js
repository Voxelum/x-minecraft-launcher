const {
    ServerInfo,
} = require('ts-minecraft')
const fs = require('fs')

export default {
    actions: {
        ping({ host, port }) {
            return ServerInfo.fetchServerStatus({ host, port }, true)
        },
        fetchServerIcon(serverInfo) {

        },
    },
}
