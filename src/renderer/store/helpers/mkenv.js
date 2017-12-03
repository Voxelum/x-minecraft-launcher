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
    const allPacks = context.state.repository.resourcepacks;
    const nameToId = {};
    Object.keys(allPacks).forEach((hash) => {
        const pack = allPacks[hash];
        nameToId[pack.name] = hash;
    });
    const all = context.getters[`profiles/${id}/resourcepacks`]
        .map(pack => ({ pack, hash: `${nameToId[pack]}.zip` }));
    await fs.ensureDir(profileLoc.resourcepacks)
    if (!all) return Promise.resolve();
    await context.dispatch('query', {
        service: 'repository',
        action: 'virtualenv',
        payload: {
            root: rootLoc.getPath('resources'),
            target: profileLoc.getPath('resourcepacks'),
            elements: all,
        },
    }).catch((e) => {
        console.warn('Cannot export resourcepack')
        console.warn(e)
    });
    return true;
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
