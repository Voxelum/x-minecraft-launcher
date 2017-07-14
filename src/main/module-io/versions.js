const fs = require('fs')
const {
    VersionMetaList,
    Version,
    VersionChecker
} = require('ts-minecraft')
export default {
    initialize(launcher) {
        return new Promise((resolve, reject) => {
            fs.readFile(launcher.getPath('versions.json'), (err, data) => {
                if (err) reject(err)
                else return JSON.parse(data.toString())
            })
        });
    }
}