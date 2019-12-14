import { GameSetting, Server } from '@xmcl/minecraft-launcher-core';
import { FSWatcher } from 'fs';
import { fitin, fs, requireObject, requireString, willBaselineChange } from 'main/utils';
import { getPersistence, readFolder, setPersistence } from 'main/utils/persistence';
import InstanceConfigSchema from 'main/utils/schema/InstanceConfig.json';
import ProfilesConfig from 'main/utils/schema/ProfilesConfig.json';
import { CreateOption, createTemplate } from 'universal/store/modules/instance';
import { InstanceConfig, InstanceLockConfig } from 'universal/store/modules/instance.config';
import { LATEST_MC_RELEASE } from 'universal/utils/constant';
import { PINGING_STATUS } from 'universal/utils/server-status';
import { v4 } from 'uuid';
import * as ioPartial from './InstanceService.io';
import * as logPartial from './InstanceService.log';
import * as savePartial from './InstanceService.save';
import * as serverPartial from './InstanceService.server';
import JavaService from './JavaService';
import ResourceService from './ResourceService';
import ServerStatusService from './ServerStatusService';
import Service, { Inject } from './Service';
import { vfs } from '@xmcl/util';

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

    protected saveWatcher: FSWatcher | undefined;

    protected isSavesDirty = false;

    protected getPathUnder(...ps: string[]) {
        return this.getPath('profiles', ...ps);
    }

    async loadProfileGameSettings(id: string = this.state.instance.id) {
        requireString(id);

        const { commit } = this;
        try {
            const opPath = this.getPathUnder(id, 'options.txt');
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

    async loadProfileSeverData(id: string = this.state.instance.id) {
        requireString(id);

        const { commit } = this;
        try {
            const serverPath = this.getPathUnder(id, 'servers.dat');
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

    async loadInstanceLock(id: string) {
        requireString(id);
        const { commit } = this;

        const jsonPath = this.getPathUnder(id, 'instance-lock.json');
        if (await fs.missing(jsonPath)) {
            await fs.remove(this.getPathUnder(id));
            this.warn(`Corrupted profile ${id}`);
            return;
        }

        let option: InstanceLockConfig;
        try {
            option = await getPersistence({ path: jsonPath });
        } catch (e) {
            this.warn(`Corrupted profile json ${id}`);
            return;
        }

        const lockFile = {
            ...option,
        };
        const config = this.state.instance.all[id];
        if (!lockFile.java) {
            const javaVersion = config.runtime.java;
            const local = this.state.java.all.find(j => j.majorVersion.toString() === javaVersion || j.version === javaVersion);
            if (local) {
                lockFile.java = local.path;
            }
        }

        for (const domainName of Object.keys(lockFile.deployed)) {
            const domain = lockFile.deployed[domainName];
            for (const name of Object.keys(domain)) {
                const value = domain[name];
                if (value.src) {
                    this.getPathUnder();
                    vfs.exists(value.src);
                }
            }
        }

        commit('lockFile', lockFile);
    }

    async loadProfile(id: string) {
        requireString(id);

        const { commit, getters } = this;

        const jsonPath = this.getPathUnder(id, 'profile.json');
        if (await fs.missing(jsonPath)) {
            await fs.remove(this.getPathUnder(id));
            this.warn(`Corrupted profile ${id}`);
            return;
        }

        let option: InstanceConfig;
        try {
            option = await getPersistence({ path: jsonPath, schema: InstanceConfigSchema });
        } catch (e) {
            this.warn(`Corrupted profile json ${id}`);
            return;
        }
        if (!option) {
            this.warn(`Corrupted profile ${id}`);
            return;
        }

        const profile = createTemplate(
            id,
            LATEST_MC_RELEASE,
            false,
        );

        profile.author = profile.author || getters.selectedGameProfile?.name || '';

        fitin(profile, option);
        commit('addProfile', profile);
    }

    async init() {
        const { getters } = this;
        const profiles = getters.instances;
        if (profiles.length === 0) {
            this.log('Cannot find any profile, try to init one default modpack');
            await this.createAndSelect({});
        }
    }

    async load() {
        const { state } = this;
        const dirs = await readFolder(this.getPathUnder());

        if (dirs.length === 0) {
            return;
        }

        const uuidExp = /([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}){1}/;
        await Promise.all(dirs.filter(f => uuidExp.test(f)).map(id => this.loadProfile(id)));

        if (Object.keys(state.instance.all).length === 0) {
            return;
        }

        const persis = await getPersistence({ path: this.getPath('profiles.json'), schema: ProfilesConfig });

        if (persis) {
            if (persis.selectedProfile) {
                await this.selectInstance(persis.selectedProfile);
            } else {
                await this.selectInstance(Object.keys(state.instance.all)[0]);
            }
        } else {
            await this.selectInstance(Object.keys(state.instance.all)[0]);
        }
    }

    async save({ mutation, payload }: { mutation: string; payload: any }) {
        switch (mutation) {
            case 'selectProfile':
                await setPersistence({
                    path: this.getPath('profiles.json'),
                    data: { selectedProfile: payload },
                    schema: ProfilesConfig,
                });
                break;
            case 'gamesettings':
                await fs.writeFile(this.getPathUnder(this.state.instance.id, 'options.txt'),
                    GameSetting.stringify(this.state.instance.settings));
                break;
            case 'addProfile':
            case 'profile':
                await setPersistence({
                    path: this.getPathUnder(payload.id, 'profile.json'),
                    data: payload,
                    schema: InstanceConfigSchema,
                });
                break;
            case 'lockFile':
                await setPersistence({
                    path: this.getPathUnder(payload.id, 'instance-lock.json'),
                    data: payload,
                });
                break;
            default:
        }
    }

    /**
     * Return the profile's screenshots urls.
     */
    async listProfileScreenshots(id: string) {
        const sp = this.getPathUnder(id, 'screenshots');
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
            latestRelease.id,
            true,
        );

        if (this.getters.selectedGameProfile) {
            profile.author = this.getters.selectedGameProfile.name;
        } else {
            profile.author = '';
        }

        Reflect.deleteProperty(profile, 'creationDate');

        fitin(profile, payload);

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

        if (id === this.state.instance.id) { return; }

        console.log(`Try to select instance ${id}`);

        // eslint-disable-next-line no-unused-expressions
        this.saveWatcher?.close();
        this.saveWatcher = undefined;
        this.isSavesDirty = true;
        await Promise.all([
            this.loadInstanceSaves(id),
            this.loadProfileGameSettings(id),
            this.loadProfileSeverData(id),
            this.loadInstanceLock(id),
        ]);
        this.commit('selectProfile', id);
        // const newVersion = this.state.version;
        // console.log(`Instance version ${}`)
    }

    /**
     * Delete the instance from the disk
     * @param id The instance id
     */
    async deleteInstance(id = this.state.instance.id) {
        requireString(id);

        // if the profile is selected now
        if (this.state.instance.id === id) {
            const restId = Object.keys(this.state.instance.all).filter(i => i !== id);
            // if only one profile left
            if (restId.length === 0) {
                // then create and select a new one
                await this.createAndSelect({});
            } else {
                // else select the first profile
                await this.selectInstance(restId[0]);
            }
        }
        this.commit('removeProfile', id);
        const profileDir = this.getPathUnder(id);
        if (await fs.exists(profileDir)) {
            await fs.remove(profileDir);
        }
    }

    /**
     * Edit the current profile.
     */
    async editInstance(profile: Partial<InstanceConfig>) {
        requireObject(profile);

        const current = this.state.instance.all[this.state.instance.id];
        if (willBaselineChange(profile, current)) {
            this.log(`Modify Profle ${JSON.stringify(profile, null, 4)}`);
            this.commit('profile', profile);
        }
    }

    /**
     * If current instance is a server. It will refresh the server status
     */
    async refreshProfile() {
        const prof = this.getters.selectedInstance;
        if (prof.server) {
            const { host, port } = prof.server;
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

    /**
     * Copy current profile `src` save to other profile. The `dest` is the array of profile id. 
     */
    readonly copySave = savePartial.copySave.bind(this);

    /**
     * Import a save from a `zip` or `folder`.
     * @param filePath 
     */
    readonly importSave = savePartial.importSave.bind(this);

    /**
     * Export the save as a zip or a directory
     */
    readonly exportSave = savePartial.exportSave.bind(this);

    /**
     * Delete a save in current instance
     * @param name The name of the save
     */
    readonly deleteSave = savePartial.deleteSave.bind(this);

    /**
     * Load the actual save data for current instance
     */
    readonly loadInstanceSaves = savePartial.loadInstanceSaves.bind(this);

    /**
     * Provide a list of preview for every instances' saves
     */
    readonly getAllInstancesSavePreview = savePartial.loadAllInstancesSaves.bind(this);

    /**
     * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
     * @param option Which instance is exporting (search by id), where to export (dest), include assets? 
     */
    readonly exportInstance = ioPartial.exportInstance.bind(this);

    /**
     * Import external profile into the launcher. The profile can be a curseforge zip, or a normal Minecraft file/zip. 
     * @param location The location of the profile try to import
     */
    readonly importInstance = ioPartial.importInstance.bind(this);

    readonly createProfileFromServer = serverPartial.createProfileFromServer;

    readonly refreshAll = serverPartial.refreshAll.bind(this);
}
