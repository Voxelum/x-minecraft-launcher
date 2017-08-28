import fs from 'fs-extra'

async function mkRespack(context, id, rootLoc, profileLoc) {
    const allPacks = context.getters['resourcepacks/allKeys'];
    const targetDirectory = profileLoc.resourcepacks;
    await fs.ensureDir(targetDirectory)

    return Promise.all(allPacks.map(key => context.dispatch('resourcepacks/export', { resource: key, targetDirectory })
        .catch((e) => {
            console.warn(`Cannot export resourcepack id: ${key}`)
            console.warn(e)
        })))
}
async function mkMods(context, id, rootFolder, profileFolder) {
    const targetDirectory = profileFolder.mods;
    await fs.remove(targetDirectory)
    await fs.ensureDir(targetDirectory);
    const getMod = context.getters['mods/get'];
}
export default async function (context, profileId, rootLoc, profileLoc) {
    await mkRespack(context, profileId, rootLoc, profileLoc)
    await mkMods(context, profileId, rootLoc, profileLoc)
}
