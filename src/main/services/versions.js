const fs = require('fs')
const {
    Version,
    MinecraftFolder,
} = require('ts-minecraft')

const versionProviders = new Map()
// import semver from 'semver'

export default {
    initialize() {
    },
    proxy: {
    },
    actions: {
        refresh(updateTime) {
            return Version.updateVersionMeta({ date: updateTime })
        },
        parse({ version, location }) {
            return Version.parse(location, version)
        },
        downloadClient({ meta, location }) {
            if (typeof location === 'string') location = new MinecraftFolder(location)
            if (!(location instanceof MinecraftFolder)) return Promise.reject('Require location as string or MinecraftLocation!')
            return Version.install('client', meta, location);
        },
        checkClient({ version, location }) {
            if (typeof location === 'string') location = new MinecraftFolder(location)
            if (!(location instanceof MinecraftFolder)) return Promise.reject('Require location as string or MinecraftLocation!')
            return Version.checkDependency(version, location)
        },
    },
}
