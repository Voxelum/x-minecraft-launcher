import { Version, MinecraftFolder, Forge } from 'ts-minecraft'

const versionProviders = new Map()
// import semver from 'semver'

export default {
    initialize() {
    },
    proxy: {
    },
    actions: {
        async refreshForge() {
            const remoteList = await Forge.VersionMetaList.update()

            const list = remoteList.list;
            Object.keys(list.mcversion).forEach((mcver) => {
                list.mcversion[mcver] = list.mcversion[mcver].map(id => list.number[id]);
            })
            Object.keys(list.promos).forEach((mcver) => {
                list.promos[mcver] = list.number[list.promos[mcver]];
            })
            delete list.number
            delete list.branches

            return remoteList
        },
        downloadForge(context, { meta, minecraft }) {
            if (!meta) throw new Error('Meta cannot be undefined!')
            return Forge.install(meta, new MinecraftFolder(minecraft))
        },
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
