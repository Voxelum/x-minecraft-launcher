import { NBT } from 'ts-minecraft'
const fs = require('fs')
export default {
    initialize(launcher) {
        return new Promise((resolve, reject) => {
            fs.readFile(launcher.serversPath, (err, data) => {
                if (err) reject(err)
                else {
                    NBT.read(data, false).root
                }
            })

        });
    }
}