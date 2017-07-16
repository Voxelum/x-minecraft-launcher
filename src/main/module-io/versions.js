const fs = require('fs')
const {
    VersionMetaList,
    Version,
    VersionChecker,
} = require('ts-minecraft')

export default {
    load(context) {
        return new Promise((resolve, reject) => {
            const fpath = context.getPath('versions.json')
            if (fs.existsSync(fpath)) {
                fs.readFile(context.getPath('versions.json'), (err, data) => {
                    if (err) reject(err)
                    else resolve(JSON.parse(data.toString()))
                })
            } else {
                resolve({})
            }
        });
    },
}
