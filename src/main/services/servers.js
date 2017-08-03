const {
    ServerInfo,
} = require('ts-minecraft')
const fs = require('fs')

export default {
    actions: {
        ping({ host, port }) {
            console.log(host, port)
            return ServerInfo.fetchServerStatusFrame({ host, port }, 335)
        },
        fetchServerIcon(serverInfo) {

        },
    },
}
