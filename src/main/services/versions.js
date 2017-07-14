const fs = require('fs')
const {
    VersionMetaList,
    Version,
    VersionChecker
} = require('ts-minecraft')
export default {

    update: VersionMetaList.update,
    parseVersion(version) {
        Version.parse()
    },
    downloadVersion(version) {

    }
}