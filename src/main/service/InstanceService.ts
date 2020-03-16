import { exists, missing, readdirEnsured } from '@main/util/fs';
import { CreateOption, createTemplate } from '@universal/store/modules/instance';
import { DeployedInfo, InstanceLockSchema, InstanceSchema, InstancesSchema } from '@universal/store/modules/instance.schema';
import { UNKNOWN_RESOURCE } from '@universal/store/modules/resource';
import { requireObject, requireString } from '@universal/util/assert';
import latestRelease from '@universal/util/lasteRelease.json';
import { fitin, shouldPatch } from '@universal/util/object';
import { getHostAndPortFromIp, PINGING_STATUS } from '@universal/util/serverStatus';
import { queryStatus, Status } from '@xmcl/client';
import { parse, stringify } from '@xmcl/gamesetting';
import { readInfo, ServerInfo } from '@xmcl/server-info';
import { lstat, readdir, readFile, readlink, remove, symlink, unlink, writeFile } from 'fs-extra';
import { join, relative, resolve } from 'path';
import v4 from 'uuid/v4';
import CurseForgeService from './CurseForgeService';
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

    @Inject('InstanceIOService')
    protected readonly ioService!: InstanceIOService;

    protected getPathUnder(...ps: string[]) {
        return this.getGameAssetsPath(INSTANCES_FOLDER, ...ps);
    }

    @Singleton()
    async loadInstanceGameSettings(path: string) {
        requireString(path);

        let { commit } = this;

        try {
            let optionsPath = join(path, 'options.txt');
            let result = await readFile(optionsPath, 'utf-8').then(b => b.toString()).then(parse);
            commit('instanceCache', { gamesettings: result });
        } catch (e) {
            if (!e.message.startsWith('ENOENT:')) {
                this.warn(`An error ocurrs during parse game options of ${path}.`);
                this.warn(e);
            }
        }
    }

    @Singleton()
    async loadInstanceSeverData(path: string) {
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

        // const config = this.state.instance.all[path];
        // if (!lockFile.java) {
        //     const javaVersion = config.runtime.java;
        //     const local = this.state.java.all.find(j => j.majorVersion.toString() === javaVersion || j.version === javaVersion);
        //     if (local) { lockFile.java = local.path; }
        // }

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

        fitin(instance, option);

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
        await this.setPersistence({
            path: this.getPath(INSTANCES_JSON),
            data: { selectedInstance: path, instances: [] },
            schema: InstancesSchema,
        });
        this.log(`Saved instance selection ${path}`);
    }

    @MutationTrigger('instanceGameSettings')
    async saveInstanceGameSetting() {
        await writeFile(join(this.state.instance.path, 'options.txt'),
            stringify(this.state.instance.settings));
        this.log(`Saved instance gamesettings ${this.state.instance.path}`);
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

        fitin(instance, payload);

        instance.path = this.getPathUnder(v4());
        instance.runtime.minecraft = this.getters.minecraftRelease.id;
        instance.author = this.getters.gameProfile?.name ?? '';
        instance.creationDate = Date.now();

        instance.author = payload.author ?? instance.author;
        instance.description = payload.description ?? instance.description;
        instance.showLog = payload.showLog ?? instance.showLog;

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

        // eslint-disable-next-line no-unused-expressions
        this.saveService?.mountInstanceSaves(path);

        this.loadInstanceGameSettings(path);
        this.loadInstanceSeverData(path);

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
        let instanceDirectory = this.getPathUnder(path);
        if (managed && await exists(instanceDirectory)) {
            await remove(instanceDirectory);
        }
    }

    /**
     * Edit the instance. If the `id` is not present
     */
    async editInstance(patch: Partial<InstanceSchema> & { path?: string }) {
        requireObject(patch);

        let targetPath = patch.path || this.state.instance.path;
        let target = this.state.instance.all[targetPath];
        if (shouldPatch(patch, target)) {
            this.log(`Modify instance ${JSON.stringify(patch, null, 4)}.`);
            this.commit('instance', { ...patch, path: targetPath });
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
                'fabric-loader': '',
                yarn: '',
            };
            if (info.status.modinfo && info.status.modinfo.type === 'FML') {
                options.deployments = { mods: info.status.modinfo.modList.map(m => `forge:${m.modid}/${m.version}`) };
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
        const alreadyDeployed = this.state.instance.deployed;
        const promises: Promise<DeployedInfo>[] = Object.values(instance.deployments).reduce((a, b) => [...a, ...b]).map(async (url) => {
            const root = this.state.instance.path;
            const alreadyDeployedInfo = alreadyDeployed.find(d => d.url);
            if (alreadyDeployedInfo) {
                if (alreadyDeployedInfo.resolved) {
                    // if using link, validate link again
                    if (alreadyDeployedInfo.resolved === 'link') {
                        const destPath = join(root, alreadyDeployedInfo.file);
                        const realPath = resolve(await readlink(destPath));
                        if (realPath !== alreadyDeployedInfo.src!) {
                            await symlink(alreadyDeployedInfo.src!, destPath);
                        }
                    }
                    return alreadyDeployedInfo;
                }
            }
            const result: DeployedInfo = {
                url,
                file: '',
                integrity: '',
                resolved: false,
            };
            let res = this.getters.queryResource(url);
            if (res === UNKNOWN_RESOURCE && !localOnly) {
                res = await this.resourceService.importResource({ uri: url, metadata: {} });
                this.warn(`No local resource matched uri ${url}!`);
            }
            if (res !== UNKNOWN_RESOURCE) {
                result.src = res.path;
                result.integrity = res.hash;
                if (res.domain === 'mods' || res.domain === 'resourcepacks') {
                    const dest = join(this.state.instance.path, res.domain, res.name + res.ext);
                    try {
                        const stat = await lstat(dest);
                        if (stat.isSymbolicLink()) {
                            await unlink(dest);
                            await symlink(res.path, dest);
                        } else {
                            this.pushException({ type: 'deployLinkResourceOccupied', resource: res });
                            this.error(`Cannot deploy resource ${res.hash} -> ${dest}, since the path is occupied.`);
                        }
                    } catch (e) {
                        await symlink(res.path, dest);
                    }
                    result.file = relative(root, dest);
                    result.resolved = 'link';
                } else if (res.domain === 'saves') {
                    const dest = await this.saveService.importSave({ source: res.path });
                    result.file = relative(root, dest);
                    result.resolved = 'unpack';
                } else if (res.domain === 'modpacks') { // modpack will override the profile
                    await this.ioService.importCurseforgeModpack({
                        instancePath: this.state.instance.path,
                        path: res.path,
                    });
                    result.file = '/';
                    result.resolved = 'unpack';
                }
            }
            return result;
        });
        const deployed = await Promise.all(promises);
        this.commit('instanceDeployInfo', deployed);
    }
}

export default InstanceService;
