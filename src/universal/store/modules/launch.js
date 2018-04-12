import fs from 'fs-extra'
import { ActionContext } from 'vuex'
import { MinecraftFolder, Launcher } from 'ts-minecraft'
import paths from 'path'
import { ipcMain } from 'electron'
// import { ipcRenderer } from 'electron'

function onerror(e) {
    if (e.message.startsWith('Cannot find version ') || e.message.startsWith('No version file for ') || e.message.startsWith('No version jar for ')) {
        e.type = 'missing.version'
    } else if (e.message === 'Missing library') {
        e.type = 'missing.libraries'
    } else if (e.message === 'Missing asset!') {
        e.type = 'missing.assets'
    } else if (e.message === 'Missing mainClass' || e.message === 'Missing minecraftArguments') {
        e.type = 'illegal.version.json'
    }
    return e
}

export default {
    getters: {
        error: (state, getters, rootState, rootGetters) => {
            const errors = [];
            
            if (!state.java) errors.push('error.missingJava');
            if (!state.mcversion) errors.push('error.missingMc');
            // rootGetters[`profiles/${state.id}/`]
        },
    },
    actions: {
        /**
        * @param {ActionContext} context 
        */
        async launch(context, profileId) {
            /**
             * Preconditions
             */

            const auth = context.rootState.user.auth;
            if (!auth) return Promise.reject('launch.auth.empty');

            const profile = context.rootGetters['profiles/get'](profileId);
            if (!profile) return Promise.reject('launch.profile.empty')

            if (!auth.accessToken || !auth.selectedProfile || !auth.selectedProfile.name || !auth.selectedProfile.id) return Promise.reject('launch.auth.illegal');

            let version = profile.mcversion;

            /**
             * Handle version
             */
            const forgeVersion = context.rootGetters[`profiles/${profileId}/forge/version`];
            if (context.rootGetters[`profiles/${profileId}/forge/selected`] !== 0 && forgeVersion !== '') {
                version = `${version}-forge${version}-${forgeVersion}`
            }

            /**
             * Handle profile error
             */
            const type = profile.type;
            // const errors = context.getters[`profiles/${profileId}/errors`]
            // if (errors && errors.length !== 0) return Promise.reject(errors[0])

            /**
             * Build launch condition
             */
            const option = {
                auth,
                gamePath: paths.join(context.rootState.root, 'profiles', profileId),
                resourcePath: context.rootState.root,
                javaPath: profile.java || context.rootGetters['java/default'],
                minMemory: profile.minMemory || 1024,
                maxMemory: profile.maxMemory || 1024,
                version,
            }
            if (profile.type === 'server') {
                option.server = { ip: profile.host, port: profile.port };
            }

            const minecraftFolder = new MinecraftFolder(option.gamePath);

            /**
             * Make resourcepack environment. Here we rebuild the resource by name
             */
            try {
                await fs.ensureDir(minecraftFolder.resourcepacks);

                const allPacks = context.rootState.repository.resourcepacks;
                const nameToId = {};
                Object.keys(allPacks).forEach((hash) => {
                    const pack = allPacks[hash];
                    nameToId[pack.name] = hash;
                });

                await Promise.all(context.rootGetters[`profiles/${profileId}/settings/resourcepacks`]
                    .map(pack => context.dispatch('repository/link', {
                        resource: nameToId[pack],
                        minecraft: option.gamePath,
                    })));
            } catch (e) {
                console.error('Cannot export resource packs')
                console.error(e);
            }

            /**
             * Make mod environment. Here we rebuild the resource by modid:version
             */
            try {
                await fs.emptyDir(minecraftFolder.mods);

                const mods = context.rootGetters['repository/mods'];
                const selected = context.rootGetters[`profiles/${profileId}/forge/selected`];

                const modIdVersions = {};
                for (const res of mods) {
                    for (const mod of res.meta.mods) {
                        modIdVersions[`${mod.meta.modid}:${mod.meta.version}`] = res.hash
                    }
                }
                const selectingHashs = selected.map(k => modIdVersions[k])
                    .filter(mod => mod !== undefined);
                await Promise.all(selectingHashs
                    .map(hash => context.dispatch('repository/link', {
                        resource: hash,
                        minecraft: option.gamePath,
                    })));
            } catch (e) {
                console.error('Cannot export mods')
                console.error(e)
            }

            console.log(JSON.stringify(option));

            /**
             * Launch
             */
            return Launcher.launch(option).then((process) => {
                ipcMain.emit('park');
                process.on('error', (err) => {
                    console.log(err)
                })
                process.on('exit', (code, signal) => {
                    console.log(`exit: ${code}, signal: ${signal}`)
                    ipcMain.emit('restart')
                })
                process.stdout.on('data', (s) => {
                    ipcMain.emit('minecraft-stdout', s.toString());
                })
                process.stderr.on('data', (s) => {
                    console.error(s)
                    ipcMain.emit('minecraft-stderr', s)
                })
            }).catch((e) => {
                throw onerror(e);
            })
        },
    },
}
