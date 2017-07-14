const fs = require('fs')
const {
    VersionMetaList,
    Version,
    VersionChecker
} = require('ts-minecraft')
export default {
    load(context) {
        return new Promise((resolve, reject) => {
            fs.readFile(context.getPath('versions.json'), (err, data) => {
                if (err) reject(err)
                else return JSON.parse(data.toString())
            })
        });
    }
}