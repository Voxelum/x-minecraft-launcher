import fs from 'fs-extra'
import { ActionContext } from 'vuex'
import { MinecraftFolder } from 'ts-minecraft'

/**
 * @param {ActionContext} context 
 * @param {string} id 
 * @param {MinecraftFolder} rootLoc 
 * @param {MinecraftFolder} profileLoc 
 */
async function mkRespack(context, id, rootLoc, profileLoc) {
    const allPacks = context.getters['repository/resourcepacks'];
    await fs.ensureDir(profileLoc.resourcepacks)
    if (!allPacks) return Promise.resolve();
    return Promise.all(allPacks.map(key => context.dispatch('link', { resource: key, minecraft: profileLoc.root })
        .catch((e) => {
            console.warn(`Cannot export resourcepack id: ${key}`)
            console.warn(e)
        })))
}

/**
 * @param {ActionContext} context 
 * @param {string} id 
 * @param {MinecraftFolder} rootFolder 
 * @param {MinecraftFolder} profileFolder 
 */
async function mkMods(context, id, rootFolder, profileFolder) {
    const targetDirectory = profileFolder.mods;
    await fs.remove(targetDirectory)
    await fs.ensureDir(targetDirectory);

    const getMod = context.getters['repository/mods'];
}

export default async (context, profileId, rootLoc, profileLoc) => {
    await mkRespack(context, profileId, rootLoc, profileLoc)
    await mkMods(context, profileId, rootLoc, profileLoc)
}
