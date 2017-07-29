import launcher from '../launcher'

const fs = require('fs')
const {
    VersionMetaList,
    Version,
    MinecraftLocation,
} = require('ts-minecraft')

const versionProviders = new Map()
// import semver from 'semver'

export default {
    initialize() {
        versionProviders.set('minecraft', (versionmeta) => {
        })
        const mc = new MinecraftLocation(launcher.rootPath)
        fs.readdir(mc.versions, (err, files) => {
            if (err) {
                console.error(err)
            } else {
                for (const file of files) {
                    this.actions.checkClient({ version: file, location: mc })
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
            console.log('refresh!')
            return VersionMetaList.update({ date: updateTime })
        },
        parse({ version, location }) {
            return Version.parse(location, version)
        },
        downloadClient({ meta, location }) {
            if (typeof location === 'string') location = new MinecraftLocation(location)
            if (!(location instanceof MinecraftLocation)) return Promise.reject('Require location as string or MinecraftLocation!')
            console.log(meta)
            console.log(location)
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
            if (typeof location === 'string') location = new MinecraftLocation(location)
            if (!(location instanceof MinecraftLocation)) return Promise.reject('Require location as string or MinecraftLocation!')
            return Version.checkDependencies(version, location)
        },
    },
}
