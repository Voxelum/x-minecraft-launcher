const fs = require('fs')
const {
    VersionMetaList,
    Version,
    VersionChecker,
    MinecraftLocation
} = require('ts-minecraft')
import launcher from '../launcher'
const versionProviders = new Map()
import semver from 'semver'

export default {
    initialize() { },
    proxy: {
        register(id, versionProvider) {
            versionProviders.set(id, versionProvider)
        }
    },
    actions: {
        update(versionType) {
            return versionProviders.has(versionType) ? versionProviders.get(versionType).update() : Promise.reject('No such version provider: ' + versionType)
        },
        require(version) {
            //TODO handle the version dependent tree
            for (var v in version) {
                if (version.hasOwnProperty(v)) {
                    var id = version[v];
                    if (versionProviders.has(id)) {
                        versionProviders.get(id).require()
                    }
                }
            }
        },
        parse(version) {

        },
        download(version) {

        }
    }
}