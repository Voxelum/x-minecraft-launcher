import { watch } from 'fs';
import fs from 'main/utils/vfs';
import { compressZipTo, includeAllToZip } from 'main/utils/zip';
import { tmpdir } from 'os';
import paths, { basename, join, dirname, relative } from 'path';
import { latestMcRelease } from 'static/dummy.json';
import { GameSetting, Server, TextComponent, Version, World, Task } from '@xmcl/minecraft-launcher-core';
import base, { createTemplate } from 'universal/store/modules/profile';
import { fitin, willBaselineChange } from 'universal/utils/object';
import { createFailureServerStatus, PINGING_STATUS } from 'universal/utils/server-status';
import { getModIdentifier } from 'universal/utils/versions';
import uuid from 'uuid';
import { Unzip } from '@xmcl/unzip';
import { ZipFile } from 'yazl';
import { createHash } from 'crypto';

/**
 * @param {string} save
 */
async function loadWorld(save) {
    try {
        const world = await World.load(save, ['level']);
        const dest = join(save, 'icon.png');
        if (await fs.exists(dest)) {
            // const buf = await fs.readFile(dest);
            // const uri = `data:image/png;base64,${buf.toString('base64')}`;
            // if (world) {
            Reflect.set(world, 'icon', `file://${dest}`);
            // }
        }
        return world;
    } catch (e) {
        console.error(`Cannot load save ${save}`);
        console.error(e);
        return undefined;
    }
}

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
        async loadProfileGameSettings({ rootGetters, state, commit }, id = state.id) {
            const opPath = rootGetters.path('profiles', id, 'options.txt');
            try {
                const option = await fs.readFile(opPath, 'utf-8').then(b => b.toString()).then(GameSetting.parse);
                commit('profileCache', { gamesettings: option });
                return option || {};
            } catch (e) {
                console.warn(`An error ocurrs during parse game options of ${id}.`);
                console.warn(e);
                commit('profileCache', { gamesettings: {} });
                return {};
            }
        },
        async loadAllProfileSaves({ state, rootGetters, getters }) {
            /**
             * @type {any[]}
             */
            const all = [];
            for (const profile of getters.profiles) {
                const saveRoot = rootGetters.path('profiles', profile.id, 'saves');

                if (await fs.exists(saveRoot)) {
                    const saves = await fs.readdir(saveRoot).then(a => a.filter(s => !s.startsWith('.')));

                    const loaded = await Promise.all(saves.map(s => paths.resolve(saveRoot, s)).map(loadWorld));
                    loaded.filter(s => s !== undefined).forEach(s => Reflect.set(s, 'profile', profile.name));
                    all.push(...loaded);
                }
            }
            return all;
        },
        async loadProfileSaves({ rootGetters, state, commit }, id = state.id) {
            if (!state.dirty.saves) {
                return state.saves;
            }
            commit('markDirty', { target: 'saves', dirty: false });
            try {
                const saveRoot = rootGetters.path('profiles', id, 'saves');

                if (await fs.exists(saveRoot)) {
                    const saves = await fs.readdir(saveRoot).then(a => a.filter(s => !s.startsWith('.')));

                    const loaded = await Promise.all(saves.map(s => paths.resolve(saveRoot, s)).map(loadWorld));
                    /**
                     * @type {any}
                     */
                    const nonNulls = loaded.filter(s => s !== undefined);
                    console.log(`Save ${saves.length} ${nonNulls.length}`);
                    commit('profileSaves', nonNulls);
                    return nonNulls;
                }
            } catch (e) {
                console.warn(`An error ocurred during parsing the save of ${id}`);
                console.warn(e);
            }
            commit('profileSaves', []);
            return [];
        },
        async loadProfileSeverData({ rootGetters, state, commit }, id = state.id) {
            try {
                const serverPath = rootGetters.path('profiles', id, 'servers.dat');
                if (await fs.exists(serverPath)) {
                    const serverDat = await fs.readFile(serverPath);
                    const infos = await Server.readInfo(serverDat);
                    commit('serverInfos', infos);
                    return infos;
                }
            } catch (e) {
                console.warn(`An error occured during loading server infos of ${id}`);
                console.error(e);
            }
            commit('serverInfos', []);
            return [];
        },
        async loadProfile({ commit, dispatch, rootGetters, rootState }, id) {
            if (await fs.missing(rootGetters.path('profiles', id, 'profile.json'))) {
                await fs.remove(rootGetters.path('profiles', id));
                console.warn(`Corrupted profile ${id}`);
                return;
            }

            let option;
            try {
                option = await dispatch('getPersistence', { path: `profiles/${id}/profile.json`, schema: 'ProfileConfig' });
            } catch (e) {
                console.warn(`Corrupted profile json ${id}`);
                return;
            }
            if (!option) {
                console.warn(`Corrupted profile ${id}`);
                return;
            }

            const type = option.type || 'modpack';
            const profile = createTemplate(
                id,
                { path: '', version: '', majorVersion: 8 },
                latestMcRelease,
                type,
                false,
            );

            if (profile.type === 'modpack') {
                profile.author = profile.author || rootGetters.selectedGameProfile.name;
            }

            if (option && option.java && typeof option.java.path === 'string') {
                const resolved = await dispatch('resolveJava', option.java.path);
                if (!resolved) {
                    option.java = undefined;
                }
            }

            // start fix old format

            if (!option.version) option.version = {};
            if (typeof option.mcversion === 'string') {
                option.version.minecraft = option.mcversion;
            }

            if (!option.deployments) option.deployments = {};
            if (!option.deployments.mods) option.deployments.mods = [];

            if (typeof option.forge === 'object') {
                if (typeof option.forge.version === 'string') {
                    option.version.forge = option.forge.version;
                }
                const mods = option.forge.mods;
                if (mods instanceof Array) {
                    option.deployments.mods.push(...mods.map(s => s.split(':')).map(t => `forge/${t[0]}/${t[1]}`));
                }
            }
            if (typeof option.liteloader === 'object') {
                if (typeof option.liteloader.version === 'string') {
                    option.version.liteloader = option.liteloader.version;
                }
                const mods = option.liteloader.mods;
                if (mods instanceof Array) {
                    option.deployments.mods.push(...mods.map(s => s.split(':')).map(t => `liteloader/${t[0]}/${t[1]}`));
                }
            }

            // end fix old format

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

            const persis = await dispatch('getPersistence', { path: 'profiles.json', schema: 'ProfilesConfig' });

            if (persis) {
                if (persis.selectedProfile) {
                    await dispatch('selectProfile', persis.selectedProfile);
                } else {
                    await dispatch('selectProfile', Object.keys(state.all)[0]);
                }
            }
        },

        async save(context, { mutation, payload }) {
            const current = context.getters.selectedProfile;
            switch (mutation) {
                case 'selectProfile':
                    await context.dispatch('setPersistence', {
                        path: 'profiles.json',
                        data: { selectedProfile: payload },
                    });
                    break;
                case 'gamesettings':
                    await fs.writeFile(context.rootGetters.path('profiles', context.state.id, 'options.txt'),
                        GameSetting.stringify(context.state.settings));
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
                default:
            }
        },

        async listProfileScreenshots(context, id) {
            const sp = context.rootGetters.path('profiles', id, 'screenshots');
            if (await fs.exists(sp)) {
                const files = await fs.readdir(sp);
                return files.map(f => `file://${sp}/${f}`);
            }
            return [];
        },

        async createProfile(context, payload) {
            const latestRelease = context.rootGetters.minecraftRelease;
            const profile = createTemplate(
                uuid(),
                context.rootGetters.defaultJava,
                latestRelease ? latestRelease.id : latestMcRelease,
                payload.type || 'modpack',
                true,
            );

            if (profile.type === 'modpack') {
                if (context.rootGetters.selectedGameProfile) {
                    profile.author = context.rootGetters.selectedGameProfile.name;
                } else {
                    profile.author = '';
                }
            }

            delete payload.creationDate;

            fitin(profile, payload);

            await fs.ensureDir(context.rootGetters.path('profiles', profile.id));

            context.commit('addProfile', profile);

            console.log('Created profile with option');
            console.log(JSON.stringify(profile, null, 4));

            return profile.id;
        },

        async createAndSelectProfile(context, payload) {
            const id = await context.dispatch('createProfile', payload);
            await context.dispatch('selectProfile', id);
            await context.dispatch('diagnoseProfile');
            return id;
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
                if (await fs.exists(saveDir)) {
                    context.commit('markDirty', { target: 'saves', dirty: true });
                    await context.dispatch('loadProfileSaves', id);
                    saveWatcher = watch(saveDir, (target, filename) => {
                        console.log(`Detect ${id} profile saves change, dirty. Target: ${target}. Filename: ${filename}.`);
                        context.commit('markDirty', { target: 'saves', dirty: true });
                    });
                }
                const optionFile = context.rootGetters.path('profiles', id, 'options.txt');
                if (await fs.exists(optionFile)) {
                    await context.dispatch('loadProfileGameSettings', id);
                    // optionsWatcher = watch(optionFile, (target, data) => {
                    //     console.log(`Detect ${id} profile gamesettings change, reload`);
                    //     context.dispatch('loadProfileGameSettings', id);
                    // });
                }
                const seversFile = context.rootGetters.path('profiles', id, 'servers.dat');
                if (await fs.exists(seversFile)) {
                    await context.dispatch('loadProfileSeverData', id);
                    // optionsWatcher = watch(seversFile, (target, data) => {
                    //     console.log(`Detect ${id} profile server data change, reload`);
                    //     context.dispatch('loadProfileSeverData', id);
                    // });
                }
                context.commit('selectProfile', id);
            }
        },

        async deleteProfile(context, id = context.state.id) {
            if (typeof id !== 'string') {
                console.error(`Invalid contract! Should pass profile id to delete profile. Get ${id}`);
                return;
            }
            if (context.state.id === id) {
                const allIds = Object.keys(context.state.all);
                if (allIds.length === 1) {
                    await context.dispatch('createAndSelectProfile', { type: 'modpack' });
                } else {
                    await context.dispatch('selectProfile', allIds[0]);
                }
            }
            context.commit('removeProfile', id);
            const profileDir = context.rootGetters.path('profiles', id);
            if (await fs.exists(profileDir)) {
                await fs.remove(profileDir);
            }
        },


        async exportProfile(context, { id = context.state.id, dest, type = 'full' }) {
            if (context.state.refreshing) return;
            context.commit('refreshingProfile', true);
            try {
                const root = context.rootState.root;
                const from = paths.join(root, 'profiles', id);
                const file = new ZipFile();
                const promise = compressZipTo(file, dest);

                if (type === 'curseforge') {
                    throw new Error('Not implemented!');
                }

                await includeAllToZip(from, from, file);

                const { resourcepacks, mods } = await context.dispatch('resolveProfileResources', id);
                const defaultMcversion = context.state.all[id].version.minecraft;

                const carriedVersionPaths = [];

                const versionInst = await Version.parse(root, defaultMcversion);
                carriedVersionPaths.push(...versionInst.pathChain);

                if (type === 'full') {
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
                    file.addFile(resourcepack.path, `resourcepacks/${resourcepack.name}${resourcepack.ext}`);
                }

                for (const mod of mods) {
                    file.addFile(mod.path, `mods/${basename(mod.path)}`);
                }

                file.end();
                await promise;
            } finally {
                context.commit('refreshingProfile', false);
            } 
        },

        async importProfile(context, location) {
            const stat = await fs.stat(location);
            const isDir = stat.isDirectory();
            let srcFolderPath = location;
            if (!isDir) {
                const tempDir = await fs.mkdtemp(paths.join(tmpdir(), 'launcher'));
                await fs.createReadStream(location)
                    .pipe(Unzip.createExtractStream(tempDir))
                    .wait();
                srcFolderPath = tempDir;
            }
            const proiflePath = paths.resolve(srcFolderPath, 'profile.json');

            const id = uuid.v4();
            const destFolderPath = context.rootGetters.path('profiles', id);

            await fs.ensureDir(destFolderPath);
            await fs.copy(srcFolderPath, destFolderPath, (path) => {
                if (path.endsWith('/versions')) return false;
                if (path.endsWith('/assets')) return false;
                if (path.endsWith('/libraries')) return false;
                if (path.endsWith('/resourcepacks')) return false;
                if (path.endsWith('/mods')) return false;
                return true;
            });

            const modsDir = paths.resolve(srcFolderPath, 'mods');
            const mods = [];
            if (await fs.exists(modsDir)) {
                for (const file of await fs.readdir(modsDir)) {
                    try {
                        const resource = await context.dispatch('waitTask', await context.dispatch('importResource', { path: paths.resolve(srcFolderPath, 'mods', file) }));
                        if (resource) {
                            mods.push(resource.hash);
                        }
                    } catch (e) {
                        console.error(`Cannot import mod at ${file}.`);
                    }
                }
            }

            const resourcepacksDir = paths.resolve(srcFolderPath, 'resourcepacks');
            if (await fs.exists(resourcepacksDir)) {
                for (const file of await fs.readdir(resourcepacksDir)) {
                    await context.dispatch('importResource', { path: paths.resolve(srcFolderPath, 'resourcepacks', file), type: 'resourcepack' });
                }
            }

            await fs.copy(paths.resolve(srcFolderPath, 'assets'), paths.resolve(context.rootState.root, 'assets'));
            await fs.copy(paths.resolve(srcFolderPath, 'libraries'), paths.resolve(context.rootState.root, 'libraries'));

            await fs.copy(paths.resolve(srcFolderPath, 'versions'), paths.resolve(context.rootState.root, 'versions')); // TODO: check this

            let profileTemplate = {};
            const isExportFromUs = await fs.stat(proiflePath).then(s => s.isFile()).catch(_ => false);
            if (isExportFromUs) {
                profileTemplate = await fs.readFile(proiflePath).then(buf => buf.toString()).then(JSON.parse, () => ({}));
                Reflect.deleteProperty(profileTemplate, 'java');

                if (!profileTemplate.deployments) {
                    profileTemplate.deployments = {
                        mods,
                    };
                }
            }

            await fs.writeFile(context.rootGetters.path('profiles', id, 'profile.json'), JSON.stringify(profileTemplate, null, 4));

            await context.dispatch('loadProfile', id);

            if (!isDir) {
                await fs.remove(srcFolderPath);
            }
        },

        resolveProfileResources(context, id = context.state.id) {
            const profile = context.state.all[id];

            /**
             * @type {{[domain:string]: import('universal/store/modules/resource').Resource<any>[]}}
             */
            const resources = {};
            for (const domain of Object.keys(profile.deployments)) {
                const depl = profile.deployments[domain];
                if (depl instanceof Array && depl.length !== 0) {
                    const domainResources = context.rootState.resource.domains[domain];
                    resources[domain] = depl.map(h => domainResources[h]);
                }
            }

            return resources;
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
            return Server.fetchStatusFrame({ host, port }, { protocol });
        },

        async pingServers(context) {
            const version = context.getters.serverProtocolVersion;
            if (context.state.serverInfos.length > 0) {
                const results = await Promise.all(context.state.serverInfos.map(s => Server.fetchStatusFrame(s, { protocol: version })));
                return results.map((r, i) => ({ status: r, ...context.state.serverInfos[i] }));
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
                options.versions = {
                    minecraft: context.rootState.client.protocolMapping.mcversion[info.status.version.protocol][0],
                };
                if (info.status.modinfo && info.status.modinfo.type === 'FML') {
                    options.forge = {
                        mods: info.status.modinfo.modList.map(m => `forge://${m.modid}/${m.version}`),
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
            /**
             * @param {string} from
             */
            async function performImport(from) {
                const save = await World.load(from, ['level']);
                let dest = context.rootGetters.path('profiles', context.state.id, 'saves', save.level.LevelName);
                await fs.ensureFile(dest);
                while (await fs.exists(dest)) {
                    dest += ' Copy';
                }
                await fs.copy(from, dest);
                context.commit('profileSaves', [...context.state.saves, save]);
                await context.dispatch('loadProfileSaves');
            }
            try {
                const stat = await fs.stat(filePath);
                if (!stat.isDirectory()) {
                    const tempName = createHash('sha1').update(filePath).digest('hex');
                    const dest = context.rootGetters.path('temp', tempName); // save will unzip to the /saves
                    const zip = await Unzip.open(filePath);
                    const [levelEntry] = await zip.filterEntries(e => e.fileName.endsWith('level.dat'));
                    if (levelEntry) {
                        const root = dirname(levelEntry.fileName);
                        if (root !== '.') {
                            await zip.extractEntries(dest, e => relative(root, e.fileName));
                        } else {
                            await zip.extractEntries(dest);
                        }
                        zip.close();

                        await performImport(dest);
                        await fs.remove(dest);
                    }
                } else {
                    await performImport(filePath);
                }
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
            if (!path || await fs.missing(path)) {
                console.log(`Cancel save copying of ${path}`);
                return;
            }
            const expect = context.rootGetters.path('profiles', id, 'saves', saveName);
            if (path === expect) { // confirm this save is a select profile's save
                await Promise.all(
                    dest.map(p => context.rootGetters.path('profiles', p, 'saves', saveName))
                        .map(p => fs.copy(expect, p)),
                );
            } else {
                console.error(`Cannot copy map ${path}, which is not in selected profile ${id}`);
            }
        },
        async deleteSave(context, path) {
            console.log(`Start remove save from ${path}`);
            const id = context.state.id;
            const saveName = basename(path);
            if (!path || await fs.missing(path)) {
                console.log(`Cancel map removing of ${path}`);
                return;
            }
            const expect = context.rootGetters.path('profiles', id, 'saves', saveName);
            if (path === expect) { // confirm this save is a select profile's save
                await fs.remove(path);
                context.commit('markDirty', { target: 'saves', dirty: true });
                await context.dispatch('loadProfileSaves');
            } else {
                console.error(`Cannot remove map ${path}, which is not in selected profile ${id}`);
            }
            console.log(`Removed save from ${path}`);
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
                    return fs.copy(src, dest);
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
                    await fs.ensureFile(destination);
                    await transferFile(path, dest);
                } catch (e) {
                    await fs.ensureFile(destination);
                    await transferFile(path, destination);
                }
            }
        },
    },
};

export default mod;
