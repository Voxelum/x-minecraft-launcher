import { createReadStream, existsSync, promises as fs, promises, watch, exists } from 'fs';
import { copy, ensureDir, ensureFile, remove } from 'main/utils/fs';
import { compressZipTo, includeAllToZip } from 'main/utils/zip';
import { tmpdir } from 'os';
import paths, { basename, join } from 'path';
import { latestMcRelease } from 'static/dummy.json';
import { GameSetting, Server, TextComponent, Version, World } from 'ts-minecraft';
import base, { createTemplate } from 'universal/store/modules/profile';
import { fitin, willBaselineChange } from 'universal/utils/object';
import uuid from 'uuid';
import { createExtractStream } from 'yauzlw';
import { ZipFile } from 'yazl';
import { PINGING_STATUS, createFailureServerStatus } from 'universal/utils/server-status';


/**
 * @type {import('fs').FSWatcher}
 */
let saveWatcher;

/**
 * @type {import('fs').FSWatcher}
 */
let optionsWatcher;

/**
 * @type {import('fs').FSWatcher}
 */
let serversWatcher;


/**
 * @type {import('universal/store/modules/profile').ProfileModule}
 */
const mod = {
    ...base,
    actions: {
        async loadProfileGameSettings({ rootGetters, state }, id = state.id) {
            const opPath = rootGetters.path('profiles', id, 'options.txt');
            try {
                const option = await fs.readFile(opPath, 'utf-8').then(b => b.toString()).then(GameSetting.parseFrame);
                return option || {};
            } catch (e) {
                console.warn(`An error ocurrs during parse game options of ${id}.`);
                console.warn(e);
                return {};
            }
        },
        async loadProfileSaves({ rootGetters, state }, id = state.id) {
            /**
             * @param {string} save
             */
            async function loadWorld(save) {
                const world = await World.load(save, ['level']).catch(_ => undefined);
                const dest = join(save, 'icon.png');
                const buf = await promises.readFile(dest);
                const uri = `data:image/png;base64,${buf.toString('base64')}`;
                if (world) {
                    Reflect.set(world, 'icon', uri);
                }
                return world;
            }
            try {
                const saveRoot = rootGetters.path('profiles', id, 'saves');

                if (existsSync(saveRoot)) {
                    const saves = await fs.readdir(saveRoot).then(a => a.filter(s => !s.startsWith('.')));

                    const loaded = await Promise.all(saves.map(s => paths.resolve(saveRoot, s)).map(loadWorld));
                    /**
                     * @type {any}
                     */
                    const nonNulls = loaded.filter(s => s !== undefined);
                    return nonNulls;
                }
            } catch (e) {
                console.warn(`An error ocurred during parsing the save of ${id}`);
                console.warn(e);
            }
            return [];
        },
        async loadProfileSeverData({ rootGetters, state }, id = state.id) {
            try {
                const serverPath = rootGetters.path('profiles', id, 'servers.dat');
                if (existsSync(serverPath)) {
                    const serverDat = await fs.readFile(serverPath);
                    const infos = Server.readInfo(serverDat);
                    return infos;
                }
            } catch (e) {
                console.warn(`An error occured during loading server infos of ${id}`);
                console.error(e);
            }
            return [];
        },
        async loadProfile({ commit, dispatch, rootGetters, rootState }, id) {
            if (!existsSync(rootGetters.path('profiles', id, 'profile.json'))) {
                await remove(rootGetters.path('profiles', id));
                return;
            }

            const option = await dispatch('getPersistence', { path: `profiles/${id}/profile.json` });
            const type = option.type || 'modpack';
            const profile = createTemplate(
                id,
                { path: '', version: '', majorVersion: 8 },
                latestMcRelease,
                type,
            );

            if (profile.type === 'modpack') {
                profile.author = profile.author || rootState.user.name;
            }

            if (option && option.java && typeof option.java.path === 'string') {
                const resolved = await dispatch('resolveJava', option.java.path);
                if (!resolved) {
                    option.java = undefined;
                }
            }

            delete option.serverInfos;
            delete option.worlds;
            delete option.settings;
            delete option.refreshing;
            delete option.problems;
            delete option.status;

            fitin(profile, option);

            commit('addProfile', profile);
        },

        async init({ state, commit, dispatch, rootGetters, rootState }) {
            const profiles = rootGetters.profiles;
            if (profiles.length === 0) {
                console.log('Cannot find any profile, try to init one default modpack');
                await dispatch('createAndSelectProfile', { type: 'modpack' });
            } else if (!rootGetters.missingJava) {
                for (const profile of profiles) {
                    if (profile.java.path === '') {
                        commit('profile', {
                            java: rootGetters.defaultJava,
                        });
                    }
                }
            }
            dispatch('diagnoseProfile');
        },
        async load({ state, commit, dispatch }) {
            const dirs = await dispatch('readFolder', 'profiles');

            if (dirs.length === 0) {
                return;
            }

            const uuidExp = /([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}){1}/;
            await Promise.all(dirs.filter(f => uuidExp.test(f)).map(id => dispatch('loadProfile', id)));

            if (Object.keys(state.all).length === 0) {
                return;
            }

            const persis = await dispatch('getPersistence', { path: 'profiles.json' });
            if (persis && persis.selected) {
                dispatch('selectProfile', persis.selected);
            } else {
                dispatch('selectProfile', Object.keys(state.all)[0]);
            }
        },

        async save(context, { mutation, payload }) {
            const current = context.getters.selectedProfile;
            switch (mutation) {
                case 'selectProfile':
                    await context.dispatch('setPersistence', {
                        path: 'profiles.json',
                        data: { selected: payload },
                    });
                    break;
                case 'gamesettings':
                    await fs.writeFile(context.rootGetters.path('profiles', context.state.id, 'options.txt'),
                        GameSetting.stringify(context.getters.selectedProfile.settings));
                    break;
                case 'addProfile':
                    await context.dispatch('setPersistence', {
                        path: `profiles/${payload.id}/profile.json`,
                        data: {
                            ...payload,
                            serverInfos: undefined,
                            settings: undefined,
                            saves: undefined,
                            problems: undefined,
                            refreshing: undefined,
                            status: undefined,
                        },
                    });
                    break;
                case 'profile':
                    await context.dispatch('setPersistence', {
                        path: `profiles/${context.state.id}/profile.json`,
                        data: {
                            ...current,
                            serverInfos: undefined,
                            settings: undefined,
                            saves: undefined,
                            problems: undefined,
                            refreshing: undefined,
                            status: undefined,
                        },
                    });
                    break;
                case 'removeProfile':
                default:
            }
        },

        async createProfile(context, payload) {
            const latestRelease = context.rootGetters.minecraftRelease || { id: latestMcRelease };
            const profile = createTemplate(
                uuid(),
                context.rootGetters.defaultJava,
                latestRelease.id,
                payload.type || 'modpack',
            );

            if (profile.type === 'modpack') {
                profile.author = context.rootState.user.name;
            }

            fitin(profile, payload);

            await ensureDir(context.rootGetters.path('profiles', profile.id));

            context.commit('addProfile', profile);

            console.log('Created profile with option');
            console.log(JSON.stringify(profile, null, 4));

            return profile.id;
        },

        async createAndSelectProfile(context, payload) {
            const id = await context.dispatch('createProfile', payload);
            await context.dispatch('selectProfile', id);
            await context.dispatch('diagnoseProfile');
        },

        async selectProfile(context, id) {
            if (id !== context.state.id) {
                if (saveWatcher) {
                    saveWatcher.close();
                }
                if (optionsWatcher) {
                    optionsWatcher.close();
                }
                if (serversWatcher) {
                    serversWatcher.close();
                }
                const saveDir = context.rootGetters.path('profiles', id, 'saves');
                if (existsSync(saveDir)) {
                    saveWatcher = watch(saveDir, (target, filename) => {
                        context.dispatch('loadProfileSaves', id);
                    });
                }
                const optionFile = context.rootGetters.path('profiles', id, 'options.txt');
                if (existsSync(optionFile)) {
                    optionsWatcher = watch(optionFile, (target, data) => {
                        context.dispatch('loadProfileGameSettings', id);
                    });
                }
                const seversFile = context.rootGetters.path('profiles', id, 'servers.dat');
                if (existsSync(seversFile)) {
                    optionsWatcher = watch(seversFile, (target, data) => {
                        context.dispatch('loadProfileSeverData', id);
                    });
                }
                context.commit('selectProfile', id);
            }
        },

        async deleteProfile(context, id = context.state.id) {
            if (context.state.id === id) {
                const allIds = Object.keys(context.state.all);
                if (allIds.length === 1) {
                    await context.dispatch('createAndSelectProfile', { type: 'modpack' });
                } else {
                    context.dispatch('selectProfile', allIds[0]);
                }
            }
            context.commit('removeProfile', id);
            await remove(context.rootGetters.path('profiles', id));
        },


        async exportProfile(context, { id = context.state.id, dest, noAssets = false }) {
            const root = context.rootState.root;
            const from = paths.join(root, 'profiles', id);
            const file = new ZipFile();
            const promise = compressZipTo(file, dest);
            await includeAllToZip(from, from, file);

            const { resourcepacks, mods } = await context.dispatch('resolveProfileResources', id);
            const defaultMcversion = context.state.all[id].mcversion;

            const carriedVersionPaths = [];

            const versionInst = await Version.parse(root, defaultMcversion);
            carriedVersionPaths.push(...versionInst.pathChain);

            if (!noAssets) {
                const assetsJson = paths.resolve(root, 'assets', 'indexes', `${versionInst.assets}.json`);
                file.addFile(assetsJson, `assets/indexes/${versionInst.assets}.json`);
                const objects = await fs.readFile(assetsJson, { encoding: 'utf-8' }).then(b => b.toString()).then(JSON.parse).then(manifest => manifest.objects);
                for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
                    file.addFile(paths.resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`);
                }
            }


            for (const verPath of carriedVersionPaths) {
                const versionId = paths.basename(verPath);
                const versionFiles = await fs.readdir(verPath);
                for (const versionFile of versionFiles) {
                    if (!await fs.stat(paths.join(verPath, versionFile)).then(s => s.isDirectory())) {
                        file.addFile(paths.join(verPath, versionFile), `versions/${versionId}/${versionFile}`);
                    }
                }
            }

            for (const lib of versionInst.libraries) {
                file.addFile(paths.resolve(root, 'libraries', lib.download.path),
                    `libraries/${lib.download.path}`);
            }

            for (const resourcepack of resourcepacks) {
                const filename = resourcepack.name + resourcepack.ext;
                file.addFile(paths.join(root, 'resourcepacks', filename),
                    `resourcepacks/${filename}`);
            }

            for (const mod of mods) {
                const filename = mod.name + mod.ext;
                file.addFile(paths.join(root, 'mods', filename),
                    `mods/${filename}`);
            }

            file.end();
            return promise;
        },

        async importProfile(context, location) {
            const stat = await fs.stat(location);
            const isDir = stat.isDirectory();
            let srcFolderPath = location;
            if (!isDir) {
                const tempDir = await fs.mkdtemp(paths.join(tmpdir(), 'launcher'));
                await createReadStream(location)
                    .pipe(createExtractStream(tempDir))
                    .promise();
                srcFolderPath = tempDir;
            }
            const proiflePath = paths.resolve(srcFolderPath, 'profile.json');

            const id = uuid.v4();
            const destFolderPath = context.rootGetters.path('profiles', id);

            await ensureDir(destFolderPath);
            await copy(srcFolderPath, destFolderPath, (path) => {
                if (path.endsWith('/versions')) return false;
                if (path.endsWith('/assets')) return false;
                if (path.endsWith('/libraries')) return false;
                if (path.endsWith('/resourcepacks')) return false;
                if (path.endsWith('/mods')) return false;
                return true;
            });

            const modsDir = paths.resolve(srcFolderPath, 'mods');
            const forgeMods = [];
            const litesMods = [];
            if (existsSync(modsDir)) {
                for (const file of await fs.readdir(modsDir)) {
                    try {
                        const resource = await context.dispatch('importResource', { path: paths.resolve(srcFolderPath, 'mods', file) });
                        if (resource) {
                            if (resource.type === 'forge') {
                                /**
                                 * @type {import('ts-minecraft').Forge.MetaData}
                                 */
                                const meta = resource.metadata[0];
                                forgeMods.push(`${meta.modid}:${meta.version}`);
                            } else if (resource.type === 'liteloader') {
                                /**
                                 * @type {import('ts-minecraft').LiteLoader.MetaData}
                                 */
                                const meta = resource.metadata;
                                litesMods.push(`${meta.name}:${meta.version}`);
                            }
                        }
                    } catch (e) {
                        console.error(`Cannot import mod at ${file}.`);
                    }
                }
            }

            const resourcepacksDir = paths.resolve(srcFolderPath, 'resourcepacks');
            if (existsSync(resourcepacksDir)) {
                for (const file of await fs.readdir(resourcepacksDir)) {
                    await context.dispatch('importResource', { path: paths.resolve(srcFolderPath, 'resourcepacks', file) });
                }
            }

            await copy(paths.resolve(srcFolderPath, 'assets'), paths.resolve(context.rootState.root, 'assets'));
            await copy(paths.resolve(srcFolderPath, 'libraries'), paths.resolve(context.rootState.root, 'libraries'));

            await copy(paths.resolve(srcFolderPath, 'versions'), paths.resolve(context.rootState.root, 'versions')); // TODO: check this

            let profileTemplate = {};
            const isExportFromUs = await fs.stat(proiflePath).then(s => s.isFile()).catch(_ => false);
            if (isExportFromUs) {
                profileTemplate = await fs.readFile(proiflePath).then(buf => buf.toString()).then(JSON.parse, () => ({}));
                Reflect.deleteProperty(profileTemplate, 'java');

                if (!profileTemplate.forge) {
                    profileTemplate.forge = {
                        mods: forgeMods,
                    };
                }
                if (!profileTemplate.forge.mods) profileTemplate.forge.mods = forgeMods;
                if (!profileTemplate.liteloader) {
                    profileTemplate.liteloader = {
                        mods: litesMods,
                    };
                }
                if (!profileTemplate.liteloader.mods) profileTemplate.liteloader.mods = litesMods;
            }

            await fs.writeFile(context.rootGetters.path('profiles', id, 'profile.json'), JSON.stringify(profileTemplate, null, 4));

            await context.dispatch('loadProfile', id);

            if (!isDir) {
                await remove(srcFolderPath);
            }
        },

        resolveProfileResources(context, id = context.state.id) {
            const profile = context.state.all[id];

            const modResources = [];
            const resourcePackResources = [];
            if ((profile.forge.mods && profile.forge.mods.length !== 0)
                || (profile.liteloader.mods && profile.liteloader.mods.length !== 0)) {
                const forgeMods = profile.forge.mods;
                const liteloaderMods = profile.liteloader.mods;

                const mods = context.rootState.resource.mods;

                /**
                 * @type {{[key: string]: import('universal/store/modules/resource').ResourceModule.ForgeResource}}
                 */
                const forgeModIdVersions = {};
                /**
                * @type {{[key: string]: import('universal/store/modules/resource').ResourceModule.LiteloaderResource}}
                */
                const liteNameVersions = {};

                Object.keys(mods).forEach((hash) => {
                    const mod = mods[hash];
                    if (mod.type === 'forge') {
                        forgeModIdVersions[`${mod.metadata[0].modid}:${mod.metadata[0].version}`] = mod;
                    } else {
                        liteNameVersions[`${mod.metadata.name}:${mod.metadata.version}`] = mod;
                    }
                });
                modResources.push(...forgeMods.map(key => forgeModIdVersions[key]).filter(r => r !== undefined));
                modResources.push(...liteloaderMods.map(key => liteNameVersions[key]).filter(r => r !== undefined));
            }
            if (profile.settings.resourcePacks) {
                const requiredResourcepacks = profile.settings.resourcePacks;

                /**
                 * @type {{[name:string]:import('universal/store/modules/resource').ResourceModule.ResourcePackResource}}
                 */
                const nameToId = {};
                const allPacks = context.rootState.resource.resourcepacks;
                Object.keys(allPacks).forEach((hash) => {
                    const pack = allPacks[hash];
                    nameToId[pack.name + pack.ext] = pack;
                });
                const requiredResources = requiredResourcepacks.map(packName => nameToId[packName]).filter(r => r !== undefined);
                resourcePackResources.push(...requiredResources);
            }

            return { mods: modResources, resourcepacks: resourcePackResources };
        },

        async editProfile(context, profile) {
            const current = context.state.all[context.state.id];
            if (willBaselineChange(profile, current)) {
                context.commit('launchStatus', 'ready');
                console.log(`Modify Profle ${JSON.stringify(profile, null, 4)}`);
                context.commit('profile', profile);
                await context.dispatch('diagnoseProfile');
            }
        },

        async pingServer(context, payload) {
            const { host, port = 25565, protocol } = payload;
            return Server.fetchStatusFrame({ host, port, name: '' }, { protocol });
        },

        async pingServers(context) {
            const version = context.getters.serverProtocolVersion;
            const prof = context.getters.selectedProfile;
            if (prof.serverInfos.length > 0) {
                const results = await Promise.all(prof.serverInfos.map(s => Server.fetchStatusFrame(s, { protocol: version })));
                return results.map((r, i) => ({ status: r, ...prof.serverInfos[i] }));
            }
            return [];
        },
        async refreshProfile(context) {
            const prof = context.getters.selectedProfile;
            if (prof.type === 'server') {
                context.commit('serverStatus', PINGING_STATUS);
                const { host, port } = prof;
                try {
                    const status = await Server.fetchStatusFrame({
                        host, port,
                    });
                    context.commit('serverStatus', status);
                } catch (e) {
                    switch (e.code) {
                        case 'ETIMEOUT':
                            context.commit('serverStatus', createFailureServerStatus('server.status.timeout'));
                            break;
                        case 'ENOTFOUND':
                            context.commit('serverStatus', createFailureServerStatus('server.status.nohost'));
                            break;
                        case 'ECONNREFUSED':
                            context.commit('serverStatus', createFailureServerStatus('server.status.refuse'));
                            break;
                        default:
                            context.commit('serverStatus', createFailureServerStatus('server.status.ping'));
                            break;
                    }
                }
            }
        },
        async createProfileFromServer(context, info) {
            const options = {};
            options.name = info.name;
            if (info.status) {
                if (typeof info.status.description === 'string') {
                    options.description = info.status.description;
                } else if (typeof info.status.description === 'object') {
                    options.description = TextComponent.from(info.status.description).formatted;
                }
                options.mcversion = context.rootState.client.protocolMapping.mcversion[info.status.version.protocol][0];
                if (info.status.modinfo && info.status.modinfo.type === 'FML') {
                    options.forge = {
                        mods: info.status.modinfo.modList.map(m => `${m.modid}:${m.version}`),
                    };
                }
            }
            return context.dispatch('createProfile', {
                type: 'server',
                ...options,
                host: info.host,
                port: info.port || 25565,
            });
        },
        async importSave(context, filePath) {
            const cur = context.getters.selectedProfile;
            try {
                const world = await World.load(filePath, ['level']);
                const dest = context.rootGetters.path('profiles', cur.id, 'saves', basename(filePath));
                await ensureFile(dest);
                await copy(filePath, dest);
                context.commit('worlds', [...cur.saves, world]);
            } catch (e) {
                console.error(`Cannot import save from ${filePath}`);
                console.error(e);
                throw e;
            }
        },
        async copySave(context, { src, dest }) {
            const id = context.state.id;
            const path = src;
            const saveName = basename(path);
            if (!path || !existsSync(path)) {
                console.log(`Cancel save copying of ${path}`);
                return;
            }
            const expect = context.rootGetters.path('profiles', id, 'saves', saveName);
            if (path === expect) { // confirm this save is a select profile's save
                await Promise.all(
                    dest.map(p => context.rootGetters.path('profiles', p, 'saves', saveName))
                        .map(p => copy(expect, p)),
                );
            } else {
                console.error(`Cannot copy map ${path}, which is not in selected profile ${id}`);
            }
        },
        async deleteSave(context, path) {
            console.log(`Start remove save from ${path}`);
            const id = context.state.id;
            const saveName = basename(path);
            if (!path || !existsSync(path)) {
                console.log(`Cancel map remving of ${path}`);
                return;
            }
            const expect = context.rootGetters.path('profiles', id, 'saves', saveName);
            if (path === expect) { // confirm this save is a select profile's save
                await remove(path);
            } else {
                console.error(`Cannot remove map ${path}, which is not in selected profile ${id}`);
            }
        },
        async exportSave(context, payload) {
            const { path, zip, destination } = payload;
            console.log(`Export map from ${path} to ${destination}.`);

            /**
             * @param {string} src 
             * @param {string} dest 
             */
            async function transferFile(src, dest) {
                if (!zip) {
                    return copy(src, dest);
                }
                const zipFile = new ZipFile();
                const promise = compressZipTo(zipFile, dest);
                await includeAllToZip(src, src, zipFile);
                zipFile.end();
                return promise;
            }

            if (path) {
                try {
                    const stat = await fs.stat(destination);
                    const dest = stat.isDirectory() ? join(destination, basename(path)) : destination;
                    await ensureFile(destination);
                    await transferFile(path, dest);
                } catch (e) {
                    await ensureFile(destination);
                    await transferFile(path, destination);
                }
            }
        },
    },
};

export default mod;
