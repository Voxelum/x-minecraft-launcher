const {
    ServerInfo
} = require('ts-minecraft')
const fs = require('fs')
export default {
    loadState(context) {
        return new Promise((resolve, reject) => {
            let serversPath = context.getPath('servers.dat')
            if (fs.existsSync(serversPath))
                fs.readFile(context.getPath('servers.dat'), (err, data) => {
                    if (err) reject(err)
                    else resolve(ServerInfo.readFromNBT(data))
                })
            else resolve([])
        });
    },
    deploy(launcher) {
    }
}