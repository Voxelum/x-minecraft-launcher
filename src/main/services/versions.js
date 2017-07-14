const fs = require('fs')
const {
    VersionMetaList,
    Version,
    VersionChecker,
    MinecraftLocation
} = require('ts-minecraft')
import launcher from '../launcher'
const versionProviders = new Map()
export default {
    initialize() {},
    proxy: {
        register(id, versionProvider) {
            versionProviders.set(id, versionProvider)
        }
    },
    services: {
        update: VersionMetaList.update,

        parseVersion(version) {
            return Version.parse(launcher.rootPath, version)
        },
        downloadVersion(version) {

        }
    }
}