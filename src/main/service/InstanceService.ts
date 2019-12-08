import { GameSetting, Server } from '@xmcl/minecraft-launcher-core';
import { FSWatcher, watch } from 'fs';
import { fitin, fs, requireObject, requireString, willBaselineChange } from 'main/utils';
import { getPersistence, readFolder, setPersistence } from 'main/utils/persistence';
import ProfilesConfig from 'main/utils/schema/ProfilesConfig.json';
import ProfileConfig from 'main/utils/schema/ProfileConfig.json';
import ModpackProfileConfig from 'main/utils/schema/ModpackProfileConfig.json';
import ServerProfileConfig from 'main/utils/schema/ServerProfileConfig.json';
import ServerOrModpackConfigSchema from 'main/utils/schema/ServerOrModpackConfig.json';

import { CreateOption, createTemplate, ServerAndModpack } from 'universal/store/modules/profile';
import { ServerOrModpackConfig } from 'universal/store/modules/profile.config';
import { LATEST_MC_RELEASE } from 'universal/utils/constant';
import { PINGING_STATUS } from 'universal/utils/server-status';
import { v4 } from 'uuid';
import * as ioPartial from './InstanceService.io';
import * as logPartial from './InstanceService.log';
import * as savePartial from './InstanceService.save';
import * as serverPartial from './InstanceService.server';
import JavaService from './JavaService';
import ServerStatusService from './ServerStatusService';
import ResourceService from './ResourceService';
import Service, { Inject } from './Service';

/**
 * Provide instance spliting service. It can split the game into multiple environment and dynamiclly deploy the resource to run.
 */
export default class InstanceService extends Service {
    @Inject('JavaService')
    private java!: JavaService;

    @Inject('ServerStatusService')
    readonly statusService!: ServerStatusService;

    @Inject('ResourceService')
    readonly resource!: ResourceService;

    protected saveWatcher!: FSWatcher;

    protected isSavesDirty = false;

    protected getPathUnder(...ps: string[]) {
        return this.getPath('profiles', ...ps);
    }

    async loadProfileGameSettings(id: string = this.state.profile.id) {
        requireString(id);

        const { commit } = this;
        try {
            const opPath = this.getPath('profiles', id, 'options.txt');
            const option = await fs.readFile(opPath, 'utf-8').then(b => b.toString()).then(GameSetting.parse);
            commit('profileCache', { gamesettings: option });
            return option || {};
        } catch (e) {
            if (!e.message.startsWith('ENOENT:')) {
                this.warn(`An error ocurrs during parse game options of ${id}.`);
                this.warn(e);
            }
            commit('profileCache', { gamesettings: {} });
            return {};
        }
    }

    async loadProfileSeverData(id: string = this.state.profile.id) {
        requireString(id);

        const { commit } = this;
        try {
            const serverPath = this.getPath('profiles', id, 'servers.dat');
            if (await fs.exists(serverPath)) {
                const serverDat = await fs.readFile(serverPath);
                const infos = await Server.readInfo(serverDat);
                this.log('Loaded server infos.');
                commit('serverInfos', infos);
                return infos;
            }
        } catch (e) {
            this.warn(`An error occured during loading server infos of ${id}`);
            this.error(e);
        }
        commit('serverInfos', []);
        return [];
    }

    async loadProfile(id: string) {
        requireString(id);

        const { commit, getters } = this;

        if (await fs.missing(this.getPathUnder(id, 'profile.json'))) {
            await fs.remove(this.getPathUnder(id));
            this.warn(`Corrupted profile ${id}`);
            return;
        }

        let option: ServerOrModpackConfig;
        try {
            option = await getPersistence({ path: this.getPathUnder(id, 'profile.json'), schema: ServerOrModpackConfigSchema });
        } catch (e) {
            this.warn(`Corrupted profile json ${id}`);
            return;
        }
        if (!option) {
            this.warn(`Corrupted profile ${id}`);
            return;
        }

        const type = option.type || 'modpack';
        const profile = createTemplate(
            id,
            { path: '', version: '', majorVersion: 8 },
            LATEST_MC_RELEASE,
            type,
            false,
        );

        if (profile.type === 'modpack') {
            profile.author = profile.author || getters.selectedGameProfile.name;
        }

        if (option && option.java && typeof option.java.path === 'string') {
            await this.java.resolveJava(option.java.path);
        }

        fitin(profile, option);
        commit('addProfile', profile);
    }

    async init() {
        const { getters, commit } = this;
        const profiles = getters.profiles;
        if (profiles.length === 0) {
            this.log('Cannot find any profile, try to init one default modpack');
            await this.createAndSelect({ type: 'modpack' });
        } else if (!getters.missingJava) {
            for (const profile of profiles) {
                if (profile.java.path === '') {
                    commit('profile', {
                        java: getters.defaultJava,
                    });
                }
            }
        }
    }

    async load() {
        const { getters, state, commit } = this;
        const dirs = await readFolder(this.getPathUnder());

        if (dirs.length === 0) {
            return;
        }

        const uuidExp = /([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}){1}/;
        await Promise.all(dirs.filter(f => uuidExp.test(f)).map(id => this.loadProfile(id)));

        if (Object.keys(state.profile.all).length === 0) {
            return;
        }

        const persis = await getPersistence({ path: this.getPath('profiles.json'), schema: ProfilesConfig });

        if (persis) {
            if (persis.selectedProfile) {
                await this.selectInstance(persis.selectedProfile);
            } else {
                await this.selectInstance(Object.keys(state.profile.all)[0]);
            }
        } else {
            await this.selectInstance(Object.keys(state.profile.all)[0]);
        }
    }

    async save({ mutation, payload }: { mutation: string; payload: any }) {
        const current = this.getters.selectedProfile;
        switch (mutation) {
            case 'selectProfile':
                await setPersistence({
                    path: this.getPath('profiles.json'),
                    data: { selectedProfile: payload },
                    schema: ProfilesConfig,
                });
                break;
            case 'gamesettings':
                await fs.writeFile(this.getPath('profiles', this.state.profile.id, 'options.txt'),
                    GameSetting.stringify(this.state.profile.settings));
                break;
            case 'addProfile':
                await setPersistence({
                    path: this.getPathUnder(payload.id, 'profile.json'),
                    data: payload,
                    schema: ProfileConfig,
                });
                break;
            case 'profile':
                await setPersistence({
                    path: this.getPathUnder(this.state.profile.id, 'profile.json'),
                    data: current,
                    schema: current.type === 'modpack' ? ModpackProfileConfig : ServerProfileConfig,
                });
                break;
            default:
        }
    }

    /**
     * Return the profile's screenshots urls.
     */
    async listProfileScreenshots(id: string) {
        const sp = this.getPath('profiles', id, 'screenshots');
        if (await fs.exists(sp)) {
            const files = await fs.readdir(sp);
            return files.map(f => `file://${sp}/${f}`);
        }
        return [];
    }

    /**
     * Create a instance (either a modpack or a server).
     * @param option The creation option
     */
    async createInstance(payload: CreateOption) {
        requireObject(payload);

        const latestRelease = this.getters.minecraftRelease;
        const profile = createTemplate(
            v4(),
            { path: '', majorVersion: 0, version: '' },
            latestRelease.id,
            payload.type || 'modpack',
            true,
        );

        if (profile.type === 'modpack') {
            if (this.getters.selectedGameProfile) {
                profile.author = this.getters.selectedGameProfile.name;
            } else {
                profile.author = '';
            }
        }

        Reflect.deleteProperty(profile, 'creationDate');

        fitin(profile, payload);

        if (profile.java.path === '') {
            profile.java = { ...this.getters.defaultJava };
        }

        this.commit('addProfile', profile);

        this.log('Created profile with option');
        this.log(JSON.stringify(profile, null, 4));

        return profile.id;
    }

    async createAndSelect(payload: CreateOption) {
        requireObject(payload);

        const id = await this.createInstance(payload);
        await this.selectInstance(id);
        return id;
    }

    /**
     * Select active instance
     * @param id the profile uuid
     */
    async selectInstance(id: string) {
        requireString(id);

        if (id === this.state.profile.id) { return; }

        console.log(`Try to select instance ${id}`);
        const oldVersion = this.state.version;

        this.saveWatcher?.close();
        const saveDir = this.getPath('profiles', id, 'saves');
        if (await fs.exists(saveDir)) {
            this.isSavesDirty = true;
            await this.loadProfileSaves(id);
            this.saveWatcher = watch(saveDir, () => { this.isSavesDirty = true; });
        }
        await this.loadProfileGameSettings(id);
        await this.loadProfileSeverData(id);
        this.commit('selectProfile', id);

        const newVersion = this.state.version;
        // console.log(`Instance version ${}`)
    }

    /**
     * Delete the instance from the disk
     * @param id The instance id
     */
    async deleteInstance(id = this.state.profile.id) {
        requireString(id);

        // if the profile is selected now
        if (this.state.profile.id === id) {
            const restId = Object.keys(this.state.profile.all).filter(i => i !== id);
            // if only one profile left
            if (restId.length === 0) {
                // then create and select a new one
                await this.createAndSelect({ type: 'modpack' });
            } else {
                // else select the first profile
                await this.selectInstance(restId[0]);
            }
        }
        this.commit('removeProfile', id);
        const profileDir = this.getPath('profiles', id);
        if (await fs.exists(profileDir)) {
            await fs.remove(profileDir);
        }
    }

    /**
     * Edit the current profile.
     */
    async editInstance(profile: Partial<ServerAndModpack>) {
        requireObject(profile);

        const current = this.state.profile.all[this.state.profile.id];
        if (willBaselineChange(profile, current)) {
            this.log(`Modify Profle ${JSON.stringify(profile, null, 4)}`);
            this.commit('profile', profile);
        }
    }

    /**
     * If current instance is a server. It will refresh the server status
     */
    async refreshProfile() {
        const prof = this.getters.selectedProfile;
        if (prof.type === 'server') {
            const { host, port } = prof;
            this.log(`Ping server ${host}:${port}`);
            this.commit('serverStatus', PINGING_STATUS);
            const status = await this.statusService.pingServer({ host, port });
            this.commit('serverStatus', status);
        }
    }

    readonly getCrashReportContent = logPartial.getCrashReportContent.bind(this);

    readonly getLogContent = logPartial.getLogContent.bind(this);

    readonly listCrashReports = logPartial.listCrashReports.bind(this);

    readonly listLogs = logPartial.listLogs.bind(this);

    readonly showLog = logPartial.showLog.bind(this);

    readonly removeCrashReport = logPartial.removeCrashReport.bind(this);

    readonly removeLog = logPartial.removeLog.bind(this);

    readonly showCrash = logPartial.showCrash.bind(this);

    readonly copySave = savePartial.copySave.bind(this);

    readonly importSave = savePartial.importSave.bind(this);

    readonly exportSave = savePartial.exportSave.bind(this);

    readonly deleteSave = savePartial.deleteSave.bind(this);

    readonly loadProfileSaves = savePartial.loadProfileSaves.bind(this);

    readonly loadAllProfileSaves = savePartial.loadAllProfileSaves.bind(this);

    readonly exportProfile = ioPartial.exportProfile.bind(this);

    readonly importProfile = ioPartial.importProfile.bind(this);

    readonly createProfileFromServer = serverPartial.createProfileFromServer;

    readonly refreshAll = serverPartial.refreshAll.bind(this);
}
