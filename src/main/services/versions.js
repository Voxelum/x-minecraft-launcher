import { Version, MinecraftFolder } from 'ts-minecraft'

const versionProviders = new Map()
// import semver from 'semver'

export default {
    initialize() {
    },
    proxy: {
    },
    actions: {
        refresh(context, updateTime) {
            return Version.updateVersionMeta({ date: updateTime })
        },
        parse(context, { version, location }) {
            return Version.parse(location, version)
        },
        downloadClient(context, { meta, location }) {
            if (typeof location === 'string') location = new MinecraftFolder(location)
            if (!(location instanceof MinecraftFolder)) return Promise.reject('Require location as string or MinecraftLocation!')
            return Version.install('client', meta, location);
        },
        checkClient(context, { version, location }) {
            if (typeof location === 'string') location = new MinecraftFolder(location)
            if (!(location instanceof MinecraftFolder)) return Promise.reject('Require location as string or MinecraftLocation!')
            return Version.checkDependency(version, location)
        },
    },
}
