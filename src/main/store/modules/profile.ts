import { GameSetting, Server, Version, World } from '@xmcl/minecraft-launcher-core';
import { Unzip } from '@xmcl/unzip';
import { createHash } from 'crypto';
import { FSWatcher, watch } from 'fs';
import { compressZipTo, fitin, fs, includeAllToZip, willBaselineChange } from 'main/utils';
import { tmpdir } from 'os';
import { basename, dirname, join, relative, resolve } from 'path';
import { latestMcRelease } from 'static/dummy.json';
import base, { createTemplate, ProfileModule } from 'universal/store/modules/profile';
import { ServerProfileConfig } from 'universal/store/modules/profile.config';
import { createFailureServerStatus, PINGING_STATUS } from 'universal/utils/server-status';
import { v4 } from 'uuid';
import { ZipFile } from 'yazl';
import { gunzip } from 'zlib';

async function loadWorld(save: string) {
    try {
        const world = await World.load(save, ['level']);
        const dest = join(save, 'icon.png');
        if (await fs.exists(dest)) {
            Reflect.set(world, 'icon', `file://${dest}`);
        }
        return world;
    } catch (e) {
        console.error(`Cannot load save ${save}`);
        console.error(e);
        return undefined;
    }
}

let saveWatcher: FSWatcher;
let isSavesDirty = false;

const mod: ProfileModule = {
    ...base,
    actions: {
        async loadProfileGameSettings({ rootGetters, state, commit }, id = state.id) {
            const opPath = rootGetters.path('profiles', id, 'options.txt');
            try {
                const option = await fs.readFile(opPath, 'utf-8').then(b => b.toString()).then(GameSetting.parse);
                commit('profileCache', { gamesettings: option });
                return option || {};
            } catch (e) {
                if (!e.message.startsWith('ENOENT:')) {
                    console.warn(`An error ocurrs during parse game options of ${id}.`);
                    console.warn(e);
                }
                commit('profileCache', { gamesettings: {} });
                return {};
            }
        },
        async loadAllProfileSaves({ rootGetters, getters }) {
            const all: any = [];
            for (const profile of getters.profiles) {
                const saveRoot = rootGetters.path('profiles', profile.id, 'saves');

                if (await fs.exists(saveRoot)) {
                    const saves = await fs.readdir(saveRoot).then(a => a.filter(s => !s.startsWith('.')));

                    const loaded = await Promise.all(saves.map(s => resolve(saveRoot, s)).map(loadWorld));
                    loaded.filter(s => s !== undefined).forEach(s => Reflect.set(s!, 'profile', profile.name));
                    all.push(...loaded);
                }
            }
            return all;
        },
        async loadProfileSaves({ rootGetters, state, commit }, id = state.id) {
            if (!isSavesDirty) {
                return state.saves;
            }
            isSavesDirty = false;
            try {
                const saveRoot = rootGetters.path('profiles', id, 'saves');

                if (await fs.exists(saveRoot)) {
                    const saves = await fs.readdir(saveRoot).then(a => a.filter(s => !s.startsWith('.')));

                    const loaded = await Promise.all(saves.map(s => resolve(saveRoot, s)).map(loadWorld));
                    const nonNulls: any = loaded.filter(s => s !== undefined);
                    console.log(`Loaded ${nonNulls.length} saves.`);
                    commit('profileSaves', nonNulls);
                    return nonNulls;
                }
            } catch (e) {
                if (!e.message.startsWith('ENOENT:')) {
                    console.warn(`An error ocurred during parsing the save of ${id}`);
                    console.warn(e);
                }
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
                    console.log(`Loaded server infos.`);
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
                option = await dispatch('getPersistence', { path: `profiles/${id}/profile.json`, schema: 'ServerOrModpackConfig' });
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
                        schema: 'ProfilesConfig',
                    });
                    break;
                case 'gamesettings':
                    await fs.writeFile(context.rootGetters.path('profiles', context.state.id, 'options.txt'),
                        GameSetting.stringify(context.state.settings));
                    break;
                case 'addProfile':
                    await context.dispatch('setPersistence', {
                        path: `profiles/${payload.id}/profile.json`,
                        data: payload,
                        schema: 'ProfileConfig',
                    });
                    break;
                case 'profile':
                    await context.dispatch('setPersistence', {
                        path: `profiles/${context.state.id}/profile.json`,
                        data: current,
                        schema: current.type === 'modpack' ? 'ModpackProfileConfig' : 'ServerProfileConfig',
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
                v4(),
                context.rootGetters.defaultJava,
                latestRelease.id,
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
            return id;
        },

        async selectProfile(context, id) {
            if (id !== context.state.id) {
                if (saveWatcher) {
                    saveWatcher.close();
                }
                const saveDir = context.rootGetters.path('profiles', id, 'saves');
                if (await fs.exists(saveDir)) {
                    isSavesDirty = true;
                    await context.dispatch('loadProfileSaves', id);
                    saveWatcher = watch(saveDir, (target, filename) => {
                        console.log(`Detect ${id} profile saves change, dirty. Target: ${target}. Filename: ${filename}.`);
                        isSavesDirty = true;
                    });
                }
                await context.dispatch('loadProfileGameSettings', id);
                await context.dispatch('loadProfileSeverData', id);
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
            context.commit('aquireProfile');
            try {
                const root = context.rootState.root;
                const from = join(root, 'profiles', id);
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
                    const assetsJson = resolve(root, 'assets', 'indexes', `${versionInst.assets}.json`);
                    file.addFile(assetsJson, `assets/indexes/${versionInst.assets}.json`);
                    const objects = await fs.readFile(assetsJson, { encoding: 'utf-8' }).then(b => b.toString()).then(JSON.parse).then(manifest => manifest.objects);
                    for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
                        file.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`);
                    }
                }


                for (const verPath of carriedVersionPaths) {
                    const versionId = basename(verPath);
                    const versionFiles = await fs.readdir(verPath);
                    for (const versionFile of versionFiles) {
                        if (!await fs.stat(join(verPath, versionFile)).then(s => s.isDirectory())) {
                            file.addFile(join(verPath, versionFile), `versions/${versionId}/${versionFile}`);
                        }
                    }
                }

                for (const lib of versionInst.libraries) {
                    file.addFile(resolve(root, 'libraries', lib.download.path),
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
                context.commit('releaseProfile');
            }
        },

        async importProfile(context, location) {
            const stat = await fs.stat(location);
            const isDir = stat.isDirectory();
            let srcFolderPath = location;
            if (!isDir) {
                const tempDir = await fs.mkdtemp(join(tmpdir(), 'launcher'));
                await fs.createReadStream(location)
                    .pipe(Unzip.createExtractStream(tempDir))
                    .wait();
                srcFolderPath = tempDir;
            }
            const proiflePath = resolve(srcFolderPath, 'profile.json');

            const id = v4();
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

            const modsDir = resolve(srcFolderPath, 'mods');
            const mods = [];
            if (await fs.exists(modsDir)) {
                for (const file of await fs.readdir(modsDir)) {
                    try {
                        const resource = await context.dispatch('waitTask', await context.dispatch('importResource', { path: resolve(srcFolderPath, 'mods', file) }));
                        if (resource) {
                            mods.push(resource.hash);
                        }
                    } catch (e) {
                        console.error(`Cannot import mod at ${file}.`);
                    }
                }
            }

            const resourcepacksDir = resolve(srcFolderPath, 'resourcepacks');
            if (await fs.exists(resourcepacksDir)) {
                for (const file of await fs.readdir(resourcepacksDir)) {
                    await context.dispatch('importResource', { path: resolve(srcFolderPath, 'resourcepacks', file), type: 'resourcepack' });
                }
            }

            await fs.copy(resolve(srcFolderPath, 'assets'), resolve(context.rootState.root, 'assets'));
            await fs.copy(resolve(srcFolderPath, 'libraries'), resolve(context.rootState.root, 'libraries'));

            await fs.copy(resolve(srcFolderPath, 'versions'), resolve(context.rootState.root, 'versions')); // TODO: check this

            let profileTemplate: any = {}; // TODO: typecheck
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

            const resources: { [domain: string]: import('universal/store/modules/resource').Resource<any>[] } = {};
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
            }
        },
        async pingProfiles(context) {
            const all: ServerProfileConfig[] = Object.values(context.state.all).filter(p => p.type === 'server') as any;
            const results = await Promise.all(all.map(async p => ({ [p.id]: await Server.fetchStatusFrame(p) })));
            context.commit('profileStatus', results.reduce(Object.assign, {}));
        },

        async pingServer(context, payload) {
            const { host, port = 25565, protocol } = payload;
            console.log(`Ping server ${host}:${port} with ${protocol}`);
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
                console.log(`Ping server ${host}:${port}`);
                try {
                    const status = await Server.fetchStatusFrame({
                        host, port,
                    });
                    context.commit('serverStatus', status);
                } catch (e) {
                    console.error(e);
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
            const options: Partial<ServerProfileConfig> = {};
            options.name = info.name;
            if (info.status) {
                // if (typeof info.status.description === 'string') {
                //     options.description = info.status.description;
                // } else if (typeof info.status.description === 'object') {
                //     options.description = TextComponent.from(info.status.description).formatted;
                // }
                options.version = {
                    minecraft: context.rootState.client.protocolMapping.mcversion[info.status.version.protocol][0],
                    forge: '',
                    liteloader: '',
                };
                if (info.status.modinfo && info.status.modinfo.type === 'FML') {
                    options.deployments = {
                        mods: info.status.modinfo.modList.map(m => `forge/${m.modid}/${m.version}`),
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
            async function performImport(from: string) {
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
                isSavesDirty = true;
                await context.dispatch('loadProfileSaves');
            } else {
                console.error(`Cannot remove map ${path}, which is not in selected profile ${id}`);
            }
            console.log(`Removed save from ${path}`);
        },
        async exportSave(context, payload) {
            const { path, zip, destination } = payload;
            console.log(`Export map from ${path} to ${destination}.`);

            async function transferFile(src: string, dest: string) {
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
        async listLogs(context) {
            const files = await context.dispatch('readFolder', `profiles/${context.state.id}/logs`);
            return files.filter(f => f !== '.DS_Store' && f.endsWith('.gz') || f.endsWith('.txt'));
        },
        async removeLog(context, name) {
            const filePath = context.rootGetters.path('profiles', context.state.id, 'logs', name);
            await fs.remove(filePath);
        },
        async getLogContent(context, name) {
            const filePath = context.rootGetters.path('profiles', context.state.id, 'logs', name);
            const buf = await fs.readFile(filePath);
            if (name.endsWith('.gz')) {
                return new Promise((resolve, reject) => {
                    gunzip(buf, (e, r) => {
                        if (e) reject(e);
                        else resolve(r.toString());
                    });
                });
            }
            return buf.toString();
        },
        async listCrashReports(context) {
            const files = await context.dispatch('readFolder', `profiles/${context.state.id}/crash-reports`);
            return files.filter(f => f !== '.DS_Store' && f.endsWith('.gz') || f.endsWith('.txt'));
        },
        async removeCrashReport(context, name) {
            const filePath = context.rootGetters.path('profiles', context.state.id, 'crash-reports', name);
            await fs.remove(filePath);
        },
        async getCrashReportContent(context, name) {
            const filePath = context.rootGetters.path('profiles', context.state.id, 'crash-reports', name);
            const buf = await fs.readFile(filePath);
            if (name.endsWith('.gz')) {
                return new Promise((resolve, reject) => {
                    gunzip(buf, (e, r) => {
                        if (e) reject(e);
                        else resolve(r.toString());
                    });
                });
            }
            return buf.toString();
        },
    },
};

export default mod;
