import { clearDirectoryNarrow, exists, missing, readdirEnsured } from '@main/util/fs';
import { CreateOption, createTemplate } from '@universal/store/modules/instance';
import { DeployedInfo, InstanceLockSchema, InstanceSchema, InstancesSchema, RuntimeVersions } from '@universal/store/modules/instance.schema';
import { UNKNOWN_RESOURCE } from '@universal/store/modules/resource';
import { requireObject, requireString } from '@universal/util/assert';
import latestRelease from '@universal/util/lasteRelease.json';
import { assignShallow, isPrimitiveArrayEqual } from '@universal/util/object';
import { getHostAndPortFromIp, PINGING_STATUS } from '@universal/util/serverStatus';
import { queryStatus, Status } from '@xmcl/client';
import { readInfo, ServerInfo } from '@xmcl/server-info';
import { ensureDir, ensureFile, link, readdir, readFile, remove } from 'fs-extra';
import { join, relative, resolve } from 'path';
import { v4 } from 'uuid';
import CurseForgeService from './CurseForgeService';
import InstanceGameSettingService from './InstanceGameSettingService';
import { InstanceIOService } from './InstanceIOService';
import InstanceSavesService from './InstanceSavesService';
import JavaService from './JavaService';
import ResourceService from './ResourceService';
import ServerStatusService from './ServerStatusService';
import Service, { Inject, MutationTrigger, Singleton } from './Service';

const INSTANCES_FOLDER = 'instances';
const INSTANCE_JSON = 'instance.json';
const INSTANCES_JSON = 'instances.json';
const INSTANCE_LOCK_JSON = 'instance-lock.json';

export interface EditInstanceOptions extends Partial<Omit<InstanceSchema, 'deployments' | 'runtime' | 'server'>> {
    deployments?: Record<string, string[]>;

    runtime?: Partial<RuntimeVersions>;

    /**
     * If this is undefined, it will disable the server of this instance
     */
    server?: {
        /**
         * The host of the server (ip)
         */
        host: string;
        /**
         * The port of the server
         */
        port?: number;
    } | null;
    /**
     * The target instance path. If this is absent, it will use the selected instance.
     */
    instancePath?: string;
}

/**
 * Provide instance spliting service. It can split the game into multiple environment and dynamiclly deploy the resource to run.
 */
export class InstanceService extends Service {
    @Inject('JavaService')
    protected readonly javaService!: JavaService;

    @Inject('ServerStatusService')
    protected readonly statusService!: ServerStatusService;

    @Inject('ResourceService')
    protected readonly resourceService!: ResourceService;

    @Inject('CurseForgeService')
    protected readonly curseforgeSerivce!: CurseForgeService;

    @Inject('InstanceSavesService')
    protected readonly saveService!: InstanceSavesService;

    @Inject('InstanceGameSettingService')
    protected readonly gameService!: InstanceGameSettingService;

    @Inject('InstanceIOService')
    protected readonly ioService!: InstanceIOService;

    protected getPathUnder(...ps: string[]) {
        return this.getGameAssetsPath(INSTANCES_FOLDER, ...ps);
    }

    @Singleton()
    async loadInstanceServerData(path: string) {
        requireString(path);

        let { commit } = this;
        try {
            let serversPath = join(path, 'servers.dat');
            if (await exists(serversPath)) {
                let serverDat = await readFile(serversPath);
                let infos = await readInfo(serverDat);
                this.log('Loaded server infos.');
                commit('instanceServerInfos', infos);
            }
            this.log('No server data found in instance.');
        } catch (e) {
            this.warn(`An error occured during loading server infos of ${path}`);
            this.error(e);
        }
    }

    @Singleton()
    async loadInstanceLock(path: string) {
        requireString(path);
        let { commit } = this;

        let jsonPath = join(path, INSTANCE_LOCK_JSON);
        let option: InstanceLockSchema;
        try {
            option = await this.getPersistence({ path: jsonPath, schema: InstanceLockSchema });
        } catch (e) {
            return;
        }

        let lockFile = {
            ...option,
        };

        const config = this.state.instance.all[path];
        if (!lockFile.java) {
            const javaVersion = config.java;
            if (javaVersion) {
                const local = this.state.java.all.find(j => j.majorVersion.toString() === javaVersion || j.version === javaVersion);
                if (local) { lockFile.java = local.path; }
            } else {
                let j8 = this.state.java.all.find(j => j.majorVersion === 8);
                if (j8) {
                    lockFile.java = j8.path;
                }
            }
        }

        commit('instanceLockFile', lockFile);
    }

    async loadInstance(path: string) {
        requireString(path);

        let { commit, getters } = this;

        let jsonPath = join(path, INSTANCE_JSON);
        if (await missing(jsonPath)) {
            this.warn(`Cannot load instance ${path}`);
            return;
        }

        let option: InstanceSchema;
        try {
            option = await this.getPersistence({ path: jsonPath, schema: InstanceSchema });
        } catch (e) {
            this.warn(`Cannot load instance json ${path}`);
            return;
        }

        let instance = createTemplate();

        instance.path = path;
        instance.author = instance.author || getters.gameProfile?.name || '';
        instance.runtime.minecraft = latestRelease.id;

        assignShallow(instance, option);
        if (option.runtime) {
            assignShallow(instance.runtime, option.runtime);
        }
        if (option.resolution) {
            if (instance.resolution) {
                assignShallow(instance.resolution, option.resolution);
            } else {
                instance.resolution = option.resolution;
            }
        }
        Object.assign(instance.deployments, option.deployments);

        commit('instanceAdd', instance);

        this.log(`Added instance ${instance.path}`);
    }

    async init() {
        let { getters } = this;
        let instances = getters.instances;
        if (instances.length === 0) {
            this.log('Cannot find any instances, try to init one default modpack.');
            await this.createAndSelect({});
        }
    }

    async load() {
        const uuidExp = /([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}){1}/;

        let { state } = this;
        let [managed, instanceConfig] = await Promise.all([
            readdirEnsured(this.getPathUnder()),
            this.getPersistence({ path: this.getPath(INSTANCES_JSON), schema: InstancesSchema }),
        ]);
        managed = managed.map(p => this.getPathUnder(p)).filter(f => uuidExp.test(f));

        this.log(`Found ${managed.length} managed instances and ${instanceConfig.instances.length} external instances.`);

        let all = [...managed, ...instanceConfig.instances];

        if (all.length === 0) {
            return;
        }

        await Promise.all(all.map(path => this.loadInstance(path)));

        if (Object.keys(state.instance.all).length === 0) {
            return;
        }

        if (all.indexOf(instanceConfig.selectedInstance) !== -1) {
            await this.mountInstance(instanceConfig.selectedInstance);
        } else {
            await this.mountInstance(Object.keys(state.instance.all)[0]);
        }
    }

    @MutationTrigger('instanceAdd')
    async saveNewInstance(payload: InstanceSchema & { path: string }) {
        await this.setPersistence({
            path: join(payload.path, INSTANCE_JSON),
            data: payload,
            schema: InstanceSchema,
        });
        this.log(`Saved new instance ${payload.path}`);
    }

    @MutationTrigger('instance')
    async saveInstance() {
        await this.setPersistence({
            path: join(this.state.instance.path, INSTANCE_JSON),
            data: this.state.instance.all[this.state.instance.path],
            schema: InstanceSchema,
        });
        this.log(`Saved instance ${this.state.instance.path}`);
    }

    @MutationTrigger('instanceJava', 'instanceDeployInfo')
    async saveInstanceLock() {
        await this.setPersistence({
            path: join(this.state.instance.path, INSTANCE_LOCK_JSON),
            data: { java: this.state.instance.java, deployed: this.state.instance.deployed },
            schema: InstanceLockSchema,
        });
        this.log(`Saved instance lock ${this.state.instance.path}`);
    }

    @MutationTrigger('instanceSelect')
    async saveInstanceSelect(path: string) {
        await Promise.all([this.setPersistence({
            path: this.getPath(INSTANCES_JSON),
            data: { selectedInstance: path, instances: [] },
            schema: InstancesSchema,
        }), this.setPersistence({
            path: join(path, INSTANCE_JSON),
            data: this.state.instance.all[path],
            schema: InstanceSchema,
        })]);
        this.log(`Saved instance selection ${path}`);
    }

    /**
     * Return the instance's screenshots urls.
     * 
     * If the provided path is not a instance, it will return empty array.
     */
    async listInstanceScreenshots(path: string) {
        let screenshots = join(path, 'screenshots');
        try {
            let files = await readdir(screenshots);
            return files.map(f => `file://${screenshots}/${f}`);
        } catch (e) {
            return [];
        }
    }

    /**
     * Create a managed instance (either a modpack or a server) under the managed folder.
     * @param option The creation option
     * @returns The instance path
     */
    async createInstance(payload: CreateOption): Promise<string> {
        requireObject(payload);

        let instance = createTemplate();

        assignShallow(instance, payload);
        if (payload.runtime) {
            assignShallow(instance.runtime, payload.runtime);
        }
        if (payload.resolution) {
            if (instance.resolution) {
                assignShallow(instance.resolution, payload.resolution);
            } else {
                instance.resolution = payload.resolution;
            }
        }
        Object.assign(instance.deployments, payload.deployments);

        instance.path = this.getPathUnder(v4());
        instance.runtime.minecraft = this.getters.minecraftRelease.id;
        instance.author = this.getters.gameProfile?.name ?? '';
        instance.creationDate = Date.now();

        instance.author = payload.author ?? instance.author;
        instance.description = payload.description ?? instance.description;
        instance.showLog = payload.showLog ?? instance.showLog;

        await ensureDir(instance.path);
        this.commit('instanceAdd', instance);

        this.log('Created instance with option');
        this.log(JSON.stringify(instance, null, 4));

        return instance.path;
    }

    /**
     * Create a managed instance in storage.
     */
    async createAndSelect(payload: CreateOption): Promise<string> {
        requireObject(payload);

        let path = await this.createInstance(payload);
        await this.mountInstance(path);
        return path;
    }

    /**
     * Mount the instance as the current active instance.
     * @param path the instance path
     */
    @Singleton()
    async mountInstance(path: string) {
        requireString(path);

        if (path === this.state.instance.path) { return; }

        let missed = await missing(path);
        if (missed) {
            this.log(`Cannot mount instance ${path}, either the directory not exist or the launcher has no permission.`);
            return;
        }

        this.log(`Try to mount instance ${path}.`);

        // not await this to improve the performance

        await this.loadInstanceLock(path);

        this.commit('instanceSelect', path);
    }

    /**
     * Delete the managed instance from the disk
     * @param path The instance path
     */
    async deleteInstance(path = this.state.instance.path) {
        requireString(path);

        // if the instance is selected now
        if (this.state.instance.path === path) {
            let restPath = Object.keys(this.state.instance.all).filter(p => p !== path);
            // if only one instance left
            if (restPath.length === 0) {
                // then create and select a new one
                await this.createAndSelect({});
            } else {
                // else select the first instance
                await this.mountInstance(restPath[0]);
            }
        }

        this.commit('instanceRemove', path);

        let managed = resolve(path).startsWith(resolve(this.getPathUnder()));
        let instanceDirectory = path;
        if (managed && await exists(instanceDirectory)) {
            await remove(instanceDirectory);
        }
    }

    /**
     * Edit the instance. If the `id` is not present
     */
    async editInstance(options: EditInstanceOptions) {
        requireObject(options);

        let instancePath = options.instancePath || this.state.instance.path;
        let state = this.state.instance.all[instancePath];

        let ignored = { runtime: true, deployments: true, server: true, vmOptions: true, mcOptions: true };
        let result: Record<string, any> = {};
        for (let key of Object.keys(options)) {
            if (key in ignored) {
                continue;
            }
            if (key in state) {
                if ((state as any)[key] !== (options as any)[key]) {
                    result[key] = (options as any)[key];
                }
            }
        }

        if ('deployments' in options && options.deployments) {
            let deployments = options.deployments;
            let current = state.deployments;
            result.deployments = {};
            if ((!current.mods && deployments.mods) || (!isPrimitiveArrayEqual(current.mods, deployments.mods))) {
                result.deployments.mods = deployments.mods;
            }
            if ((!current.resourcepacks && deployments.resourcepacks) || (!isPrimitiveArrayEqual(current.resourcepacks, deployments.resourcepacks))) {
                result.deployments.resourcepacks = deployments.resourcepacks;
            }
        }

        if ('runtime' in options && options.runtime) {
            let runtime = options.runtime;
            let currentRuntime = state.runtime;
            let resultRuntime: Partial<RuntimeVersions> = {};
            for (let version of Object.keys(runtime)) {
                if (version in currentRuntime) {
                    if (currentRuntime[version] !== runtime[version]) {
                        resultRuntime[version] = runtime[version];
                    }
                } else {
                    resultRuntime[version] = runtime[version];
                }
            }
            if (Object.keys(resultRuntime).length > 0) {
                result.runtime = resultRuntime;
            }
        }

        if ('server' in options) {
            if (options.server) {
                if (options.server.host !== state.server?.host || options.server.port !== state.server.port) {
                    result.server = options.server;
                }
            } else if (state.server !== undefined) {
                result.server = options.server;
            }
        }

        if ('vmOptions' in options && options.vmOptions) {
            let diff = options.vmOptions.some((e, i) => e !== state.vmOptions[i]);
            if (diff) {
                result.vmOptions = options.vmOptions;
            }
        }

        if ('mcOptions' in options && options.mcOptions) {
            let diff = options.mcOptions.some((e, i) => e !== state.mcOptions[i]);
            if (diff) {
                result.mcOptions = options.mcOptions;
            }
        }

        if (Object.keys(result).length > 0) {
            this.log(`Modify instance ${JSON.stringify(result, null, 4)}.`);
            this.commit('instance', { ...result, path: instancePath });
        }
    }

    /**
     * Set a real java path to the current instance
     * @param path The real java executable path
     */
    async setJavaPath(path: string) {
        let resolved = await this.javaService.resolveJava(path);
        if (resolved) {
            this.commit('instanceJava', path);
            this.editInstance({ java: resolved.majorVersion.toString() });
        }
    }

    /**
    * If current instance is a server. It will refresh the server status
    */
    async refreshServerStatus() {
        let prof = this.getters.instance;
        if (prof.server) {
            let { host, port } = prof.server;
            this.log(`Ping server ${host}:${port}`);
            this.commit('instanceStatus', PINGING_STATUS);
            let status = await this.statusService.pingServer({ host, port });
            this.commit('instanceStatus', status);
        }
    }

    /**
     * Refresh all instance server status if present
     */
    async refreshServerStatusAll() {
        let all = Object.values(this.state.instance.all).filter(p => !!p.server);
        let results = await Promise.all(all.map(async p => ({ [p.path]: await queryStatus(p.server!) })));
        this.commit('instancesStatus', results.reduce(Object.assign, {}));
    }

    /**
     * Create a instance by server info and status.
     * This will try to ping the server and apply the mod list if it's a forge server.
     */
    createInstanceFromServer(info: ServerInfo & { status: Status }) {
        const options: Partial<InstanceSchema> = {};
        options.name = info.name;
        if (info.status) {
            // if (typeof info.status.description === 'string') {
            //     options.description = info.status.description;
            // } else if (typeof info.status.description === 'object') {
            //     options.description = TextComponent.from(info.status.description).formatted;
            // }
            options.runtime = {
                minecraft: this.state.client.protocolMapping.mcversion[info.status.version.protocol][0],
                forge: '',
                liteloader: '',
                fabricLoader: '',
                yarn: '',
            };
            if (info.status.modinfo && info.status.modinfo.type === 'FML') {
                options.deployments = {
                    mods: info.status.modinfo.modList.map(m => `forge:${m.modid}/${m.version}`),
                } as any;
            }
        }
        return this.createInstance({
            ...options,
            server: getHostAndPortFromIp(info.ip),
        });
    }

    /**
     * Deploy all the resources in `deployments` into current instance.
     * 
     * The `mods` and `resourcepacks` will be deploied by linking the mods & resourcepacks files into the `mods` and `resourcepacks` directory of the instance.
     * 
     * The `saves` and `modpack` will be deploied by pasting the saves and modpack overrides into this instance directory.
     */
    async deploy(localOnly?: boolean): Promise<void> {
        const instance = this.getters.instance;
        this.log(`Deploy instance ${instance.path}`);
        const deployToDomain = async (domain: string, urls: string[]) => {
            await clearDirectoryNarrow(join(instance.path, domain));
            return Promise.all(urls.map(async (url) => {
                let root = this.state.instance.path;

                let resource = this.getters.queryResource(url);
                let result: DeployedInfo = {
                    // url,
                    url,
                    file: '',
                    resolved: false,
                };
                if (resource === UNKNOWN_RESOURCE) {
                    if (!localOnly) {
                        resource = await this.resourceService.importResource({ uri: url, metadata: {} });
                        this.warn(`No local resource matched uri ${url}!`);
                    } else {
                        throw new Error();
                    }
                } else {
                    result.src = resource.path;
                    let targetPath = join(root, resource.domain, `${resource.name}${resource.ext}`);
                    await ensureFile(targetPath);
                    await remove(targetPath).catch(() => { });
                    await link(resource.path, targetPath);

                    this.log(`Link resource ${resource.path}(${url}) -> ${targetPath}.`);
                    result.file = relative(root, targetPath);
                    result.resolved = 'link';
                }
                return result;
            }));
        };
        let [respacks, mods] = await Promise.all([
            deployToDomain('resourcepacks', instance.deployments.resourcepacks),
            deployToDomain('mods', instance.deployments.mods),
        ]);

        this.commit('instanceDeployInfo', [...respacks, ...mods]);
    }
}

export default InstanceService;
