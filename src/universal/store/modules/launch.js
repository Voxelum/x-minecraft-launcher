import fs from 'fs-extra'
import { ActionContext } from 'vuex'
import { MinecraftFolder } from 'ts-minecraft'
import paths from 'path'
// import { ipcRenderer } from 'electron'

export default {
    actions: {

        /**
         * @param {ActionContext} context 
         * @param {string} id 
         * @param {MinecraftFolder} rootLoc 
         * @param {MinecraftFolder} profileLoc 
         */
        async makeResourcePackEnvironment(context, payload) {
            const { id, rootLocation, profileLocation } = payload;
            const allPacks = context.state.repository.resourcepacks;
            const nameToId = {};
            Object.keys(allPacks).forEach((hash) => {
                const pack = allPacks[hash];
                nameToId[pack.name] = hash;
            });
            const targetDir = paths.join(profileLocation, 'resourcepacks');
            const all = context.getters[`profiles/${id}/resourcepacks`]
                .map(pack => ({ pack, hash: `${nameToId[pack]}.zip` }));
            if (!all) return Promise.resolve();
            await fs.emptyDir(targetDir);
            await context.dispatch('query', {
                service: 'repository',
                action: 'virtualenv',
                payload: {
                    root: paths.join(rootLocation, 'resources'),
                    target: targetDir,
                    elements: all,
                },
            }).catch((e) => {
                console.warn('Cannot export resourcepack')
                console.warn(e)
            });
            return true;
        },

        /**
         * @param {ActionContext} context 
         * @param {string} id 
         * @param {MinecraftFolder} rootFolder 
         * @param {MinecraftFolder} profileFolder 
         */
        async makeModEnvironment(context, id, rootFolder, profileFolder) {
            const targetDirectory = profileFolder.mods;
            await fs.emptyDir(targetDirectory);

            const mods = context.getters['repository/mods'];
            const selecting = context.getters[`profiles/${id}/forgeMods`];

            const modIdVersions = {};
            mods.forEach((res) => {
                res.meta.forEach((mod) => {
                    modIdVersions[`${mod.meta.modid}:${mod.meta.version}`] = { hash: `${res.hash}.jar`, pack: `${res.hash}.jar` }
                })
            })
            const selectingResources = selecting.map(k => modIdVersions[k])
                .filter(mod => mod !== undefined);

            await context.dispatch('query', {
                service: 'repository',
                action: 'virtualenv',
                payload: {
                    root: rootFolder.getPath('resources'),
                    target: targetDirectory,
                    elements: selectingResources,
                },
            }).catch((e) => {
                console.warn('Cannot export mods')
                console.warn(e)
            });
        },
        /**
        * @param {ActionContext} context 
        */
        async launch(context, profileId) {
            // const profile = context.getters['profiles/selected'];
            // const profileId = context.getters['profiles/selectedKey'];
            const auth = context.state.auth.auth;
            const profile = context.getters['profiles/get'](profileId);
            if (profile === undefined || profile === null) return Promise.reject('launch.profile.empty')
            if (auth === undefined || auth === null) return Promise.reject('launch.auth.empty');
            // well... these two totally... should not happen; 
            // if it happen... that is a fatal bug...

            if (!auth.accessToken || !auth.selectedProfile || !auth.selectedProfile.name || !auth.selectedProfile.id) return Promise.reject('launch.auth.illegal');

            let version = profile.mcversion;

            const mods = context.getters[`profiles/${profileId}/forgeMods`];
            const forgeVersion = context.getters[`profiles/${profileId}/forgeVersion`];
            if (mods.length !== 0 && forgeVersion !== '') {
                version = `${version}-forge-${forgeVersion}`
            }
            const type = profile.type;
            const errors = context.getters[`profiles/${profileId}/errors`]
            if (errors && errors.length !== 0) return Promise.reject(errors[0])

            // TODO check the launch condition!
            const option = {
                auth,
                gamePath: paths.join(context.state.root, 'profiles', profileId),
                resourcePath: context.state.root,
                javaPath: profile.java,
                minMemory: profile.minMemory || 1024,
                maxMemory: profile.maxMemory || 1024,
                version,
            }

            await context.dispatch('makeResourcePackEnvironment', { id: profileId, rootLocation: context.state.root, profileLocation: option.gamePath });
            await context.dispatch('makeModEnvironment', { id: profileId, rootLocation: context.state.root, profileLocation: option.gamePath });
            // make the launch environment

            if (profile.type === 'server') {
                option.server = { ip: profile.host, port: profile.port };
            }

            return context.dispatch('query', {
                service: 'launch',
                action: 'launch',
                payload: option,
            }).then(() => {
                // save all or do other things...
                // ipcRenderer.sendSync('park', true)
            })
        },
    },
}
