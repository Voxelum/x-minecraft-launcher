import launcher from '../launcher'

const fs = require('fs')
const {
    Version,
    MinecraftFolder,
} = require('ts-minecraft')

const versionProviders = new Map()
// import semver from 'semver'

export default {
    initialize() {
        versionProviders.set('minecraft', (versionmeta) => {
        })
        const mc = new MinecraftFolder(launcher.rootPath)
        fs.readdir(mc.versions, (err, files) => {
            if (err) {
                console.error(err)
            } else {
                for (const file of files) {
                    Version.parse(mc, file)
                        .then(version => Version.checkDependency(version, mc))
                        .catch((error) => {
                            console.error(error)
                        })
                }
            }
        })
    },
    proxy: {
        register(id, versionProvider) {
            versionProviders.set(id, versionProvider)
        },
    },
    actions: {
        update(versionType) {
            return versionProviders.has(versionType) ? versionProviders.get(versionType).update() : Promise.reject(`No such version provider: ${versionType}`)
        },
        require(version) {
            // TODO handle the version dependent tree
            for (const v in version) {
                if (version.hasOwnProperty(v)) {
                    const id = version[v];
                    if (versionProviders.has(id)) {
                        versionProviders.get(id).require()
                    }
                }
            }
        },
        refresh(updateTime) {
            return Version.updateVersionMeta({ date: updateTime })
        },
        parse({ version, location }) {
            return Version.parse(location, version)
        },
        downloadClient({ meta, location }) {
            if (typeof location === 'string') location = new MinecraftFolder(location)
            if (!(location instanceof MinecraftFolder)) return Promise.reject('Require location as string or MinecraftLocation!')
            return Version.downloadVersion('client', meta, location)
                .then(() => Version.parse(location.root, meta.id))
                .then((version) => {
                    this.actions.checkClient({ version, location })
                        .then((v) => {
                            console.log('suc!')
                        })
                        .catch((err) => {
                            console.error(err)
                        });
                    return version;
                })
        },
        checkClient({ version, location }) {
            if (typeof location === 'string') location = new MinecraftFolder(location)
            if (!(location instanceof MinecraftFolder)) return Promise.reject('Require location as string or MinecraftLocation!')
            return Version.checkDependency(version, location)
        },
    },
}
