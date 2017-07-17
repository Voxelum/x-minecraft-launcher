import launcher from '../launcher'

const fs = require('fs')
const {
    VersionMetaList,
    Version,
    VersionChecker,
} = require('ts-minecraft')

export default {
    load() {
        return new Promise((resolve, reject) => {
            const fpath = launcher.getPath('versions.json')
            if (fs.existsSync(fpath)) {
                fs.readFile(launcher.getPath('versions.json'), (err, data) => {
                    if (err) reject(err)
                    else resolve(JSON.parse(data.toString()))
                })
            } else {
                resolve({})
            }
        });
    },
}
