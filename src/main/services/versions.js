import launcher from '../launcher'

const fs = require('fs')
const {
    VersionMetaList,
    Version,
    VersionChecker,
    MinecraftLocation,
} = require('ts-minecraft')

const versionProviders = new Map()
// import semver from 'semver'

export default {
    initialize() {
        versionProviders.set('minecraft', (versionmeta) => {
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
        parse(version) {

        },
        download(version) {

        },
    },
}
