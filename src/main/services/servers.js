const {
    ServerInfo,
} = require('ts-minecraft')
const fs = require('fs')

export default {
    actions: {
        ping({ host, port }) {
            console.log(host, port)
            return ServerInfo.fetchServerStatusFrame({ host, port })
        },
        fetchServerIcon(serverInfo) {

        },
    },
}
