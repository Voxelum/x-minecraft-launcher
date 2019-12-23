import { GameSetting, Server, ServerInfoFrame } from '@xmcl/minecraft-launcher-core';
import { FSWatcher } from 'fs';
import { fitin, fs, requireObject, requireString, willBaselineChange } from 'main/utils';
import { getPersistence, readFolder, setPersistence } from 'main/utils/persistence';
import { MutationKeys } from 'universal/store';
import { CreateOption, createTemplate } from 'universal/store/modules/instance';
import { InstanceLockSchema, InstanceSchema, InstancesSchema } from 'universal/store/modules/instance.schema';
import latestRelease from 'universal/utils/lasteRelease.json';
import { PINGING_STATUS } from 'universal/utils/server-status';
import { v4 } from 'uuid';
import CurseForgeService from './CurseForgeService';
import { deploy } from './InstanceService.deploy';
import * as ioPartial from './InstanceService.io';
import * as logPartial from './InstanceService.log';
import * as savePartial from './InstanceService.save';
import * as serverPartial from './InstanceService.server';
import JavaService from './JavaService';
import ResourceService from './ResourceService';
import ServerStatusService from './ServerStatusService';
import Service, { Inject } from './Service';

const INSTANCES_FOLDER = 'instances';
const INSTANCE_JSON = 'instance.json';
const INSTANCES_JSON = 'instances.json';
const INSTANCE_LOCK_JSON = 'instance-lock.json';

/**
 * Provide instance spliting service. It can split the game into multiple environment and dynamiclly deploy the resource to run.
 */
export default class InstanceService extends Service {
    @Inject('JavaService')
    protected readonly javaService!: JavaService;

    @Inject('ServerStatusService')
    protected readonly statusService!: ServerStatusService;

    @Inject('ResourceService')
    protected readonly resource!: ResourceService;

    @Inject('CurseForgeService')
    protected readonly curseforgeSerivce!: CurseForgeService;

    protected saveWatcher: FSWatcher | undefined;

    protected isSavesDirty = false;

    protected getPathUnder(...ps: string[]) {
        return this.getPath(INSTANCES_FOLDER, ...ps);
    }

    async loadInstanceGameSettings(id?: string) {
        id = id || this.state.instance.id;
        requireString(id);
        const { commit } = this;

        let result: ReturnType<typeof GameSetting.parse> = {};
        try {
            const opPath = this.getPathUnder(id, 'options.txt');
            result = await fs.readFile(opPath, 'utf-8').then(b => b.toString()).then(GameSetting.parse);
        } catch (e) {
            if (!e.message.startsWith('ENOENT:')) {
                this.warn(`An error ocurrs during parse game options of ${id}.`);
                this.warn(e);
            }
        }
        commit('instanceCache', { gamesettings: result });
        return result;
    }

    async loadInstanceSeverData(id: string = this.state.instance.id) {
        requireString(id);

        let infos: ServerInfoFrame[] = [];
        const { commit } = this;
        try {
            const serverPath = this.getPathUnder(id, 'servers.dat');
            if (await fs.exists(serverPath)) {
                const serverDat = await fs.readFile(serverPath);
                infos = await Server.readInfo(serverDat);
                this.log('Loaded server infos.');
            }
        } catch (e) {
            this.warn(`An error occured during loading server infos of ${id}`);
            this.error(e);
        }
        commit('instanceServerInfos', infos);
        return infos;
    }

    async loadInstanceLock(id: string) {
        requireString(id);
        const { commit } = this;

        const jsonPath = this.getPathUnder(id, INSTANCE_LOCK_JSON);
        let option: InstanceLockSchema;
        try {
            option = await getPersistence({ path: jsonPath, schema: InstanceLockSchema });
        } catch (e) {
            return;
        }

        const lockFile = {
            ...option,
        };
        const config = this.state.instance.all[id];
        if (!lockFile.java) {
            const javaVersion = config.runtime.java;
            const local = this.state.java.all.find(j => j.majorVersion.toString() === javaVersion || j.version === javaVersion);
            if (local) { lockFile.java = local.path; }
        }

        commit('instanceLockFile', lockFile);
    }

    async loadInstance(id: string) {
        requireString(id);

        const { commit, getters } = this;

        const jsonPath = this.getPathUnder(id, INSTANCE_JSON);
        if (await fs.missing(jsonPath)) {
            await fs.remove(this.getPathUnder(id));
            this.warn(`Corrupted instance ${id}`);
            return;
        }

        let option: InstanceSchema;
        try {
            option = await getPersistence({ path: jsonPath, schema: InstanceSchema });
        } catch (e) {
            this.warn(`Corrupted instance json ${id}`);
            return;
        }
        if (!option) {
            this.warn(`Corrupted instance ${id}`);
            return;
        }

        const instance = createTemplate(
            id,
            latestRelease.id,
            false,
        );

        instance.author = instance.author || getters.gameProfile?.name || '';

        fitin(instance, option);
        commit('instanceAdd', instance);
    }

    async init() {
        const { getters } = this;
        const instances = getters.instances;
        if (instances.length === 0) {
            this.log('Cannot find any instances, try to init one default modpack');
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
        await Promise.all(dirs.filter(f => uuidExp.test(f)).map(id => this.loadInstance(id)));

        if (Object.keys(state.instance.all).length === 0) {
            return;
        }

        const instanceConfig: InstancesSchema = await getPersistence({ path: this.getPath(INSTANCES_JSON), schema: InstancesSchema });

        if (instanceConfig) {
            if (instanceConfig.selectedInstance) {
                await this.selectInstance(instanceConfig.selectedInstance);
            } else {
                await this.selectInstance(Object.keys(state.instance.all)[0]);
            }
        } else {
            await this.selectInstance(Object.keys(state.instance.all)[0]);
        }
    }

    async save({ mutation, payload }: { mutation: MutationKeys; payload: any }) {
        switch (mutation) {
            case 'instanceSelect':
                await setPersistence({
                    path: this.getPath(INSTANCES_JSON),
                    data: { selectedInstance: payload },
                    schema: InstancesSchema,
                });
                break;
            case 'instanceGameSettings':
                await fs.writeFile(this.getPathUnder(this.state.instance.id, 'options.txt'),
                    GameSetting.stringify(this.state.instance.settings));
                break;
            case 'instanceAdd':
                await setPersistence({
                    path: this.getPathUnder(payload.id, INSTANCE_JSON),
                    data: payload,
                    schema: InstanceSchema,
                });
                break;
            case 'instance':
                await setPersistence({
                    path: this.getPathUnder(this.state.instance.id, INSTANCE_JSON),
                    data: this.state.instance.all[this.state.instance.id],
                    schema: InstanceSchema,
                });
                break;
            case 'instanceJava':
            case 'instanceDeployInfo':
                await setPersistence({
                    path: this.getPathUnder(this.state.instance.id, INSTANCE_LOCK_JSON),
                    data: { java: this.state.instance.java, deployed: this.state.instance.deployed },
                    schema: InstanceLockSchema,
                });
                break;
            default:
        }
    }

    /**
     * Return the instance's screenshots urls.
     */
    async listInstanceScreenshots(id: string) {
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
        const instance = createTemplate(
            v4(),
            latestRelease.id,
            true,
        );

        if (this.getters.gameProfile) {
            instance.author = this.getters.gameProfile.name;
        } else {
            instance.author = '';
        }

        Reflect.deleteProperty(instance, 'creationDate');

        fitin(instance, payload);

        this.commit('instanceAdd', instance);

        this.log('Created instance with option');
        this.log(JSON.stringify(instance, null, 4));

        return instance.id;
    }

    async createAndSelect(payload: CreateOption) {
        requireObject(payload);

        const id = await this.createInstance(payload);
        await this.selectInstance(id);
        return id;
    }

    /**
     * Select active instance
     * @param id the instance uuid
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
            this.loadInstanceGameSettings(id),
            this.loadInstanceSeverData(id),
            this.loadInstanceLock(id),
        ]);
        this.commit('instanceSelect', id);
        // const newVersion = this.state.version;
        // console.log(`Instance version ${}`)
    }

    /**
     * Delete the instance from the disk
     * @param id The instance id
     */
    async deleteInstance(id = this.state.instance.id) {
        requireString(id);

        // if the instance is selected now
        if (this.state.instance.id === id) {
            const restId = Object.keys(this.state.instance.all).filter(i => i !== id);
            // if only one instance left
            if (restId.length === 0) {
                // then create and select a new one
                await this.createAndSelect({});
            } else {
                // else select the first instance
                await this.selectInstance(restId[0]);
            }
        }
        this.commit('instanceRemove', id);
        const instanceDir = this.getPathUnder(id);
        if (await fs.exists(instanceDir)) {
            await fs.remove(instanceDir);
        }
    }

    /**
     * Edit the instance. If the `id` is not present
     */
    async editInstance(instance: Partial<InstanceSchema>) {
        requireObject(instance);

        const current = this.state.instance.all[instance.id || this.state.instance.id];
        if (willBaselineChange(instance, current)) {
            this.log(`Modify Profle ${JSON.stringify(instance, null, 4)}`);
            this.commit('instance', instance);
        }
    }

    /**
     * If current instance is a server. It will refresh the server status
     */
    async refreshInstance() {
        const prof = this.getters.instance;
        if (prof.server) {
            const { host, port } = prof.server;
            this.log(`Ping server ${host}:${port}`);
            this.commit('instanceStatus', PINGING_STATUS);
            const status = await this.statusService.pingServer({ host, port });
            this.commit('instanceStatus', status);
        }
    }

    async setJavaPath(path: string) {
        const resolved = await this.javaService.resolveJava(path);
        if (resolved) {
            this.commit('instanceJava', path);
            this.editInstance({ java: resolved.majorVersion.toString() });
        }
    }

    /**
     * Deploy all the resources in `deployments` into current instance.
     * 
     * The `mods` and `resourcepacks` will be deploied by linking the mods & resourcepacks files into the `mods` and `resourcepacks` directory of the instance.
     * 
     * The `saves` and `modpack` will be deploied by pasting the saves and modpack overrides into this instance directory.
     */
    readonly deploy = deploy.bind(this);

    readonly getCrashReportContent = logPartial.getCrashReportContent.bind(this);

    readonly getLogContent = logPartial.getLogContent.bind(this);

    readonly listCrashReports = logPartial.listCrashReports.bind(this);

    readonly listLogs = logPartial.listLogs.bind(this);

    readonly showLog = logPartial.showLog.bind(this);

    readonly removeCrashReport = logPartial.removeCrashReport.bind(this);

    readonly removeLog = logPartial.removeLog.bind(this);

    readonly showCrash = logPartial.showCrash.bind(this);

    /**
     * Copy current instance `src` save to other instance. The `dest` is the array of instance id. 
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
     * Import external instance into the launcher. The instance can be a curseforge zip, or a normal Minecraft file/zip. 
     * @param location The location of the instance try to import
     */
    readonly importInstance = ioPartial.importInstance.bind(this);

    /**
     * Import the instance from curseforge modpack
     */
    readonly importInstanceFromCurseforgeModpack = ioPartial.importCurseforgeModpack.bind(this);

    /**
     * Create a instance by server info and status.
     * This will try to ping the server and apply the mod list if it's a forge server.
     */
    readonly createInstanceFromServer = serverPartial.createInstanceFromServer;

    /**
     * Refresh all instance server status if present
     */
    readonly refreshInstances = serverPartial.refreshAll.bind(this);
}
