import { Status as ServerStatus } from '@xmcl/client';
import { Frame as GameSetting } from '@xmcl/gamesetting';
import { ServerInfo } from '@xmcl/server-info';
import { ModuleOption } from '../root';
import { DeployedInfo, InstanceLockSchema, InstanceSchema } from './instance.schema';
import { Java } from './java';
import { Resource } from './resource';
import { LocalVersion } from './version';
import { set, remove } from '@universal/util/middleware';

export type CreateOption = DeepPartial<Omit<InstanceSchema, 'id' | 'lastAccessDate' | 'creationDate'>>;
export interface SaveMetadata {
    path: string;
    instanceName: string;
    name: string;
    icon: string;
}
export { InstanceSchema as InstanceConfig };

export interface Instance extends InstanceSchema {
    path: string;

    /**
     * The server status
     */
    serverStatus: ServerStatus | undefined;
}

interface State extends InstanceLockSchema {
    /**
     * All loaded launch instances
     */
    all: { [path: string]: Instance };
    /**
     * Current selected path
     */
    path: string;

    /**
     * Cache loaded server info in servers.dat
     */
    serverInfos: ServerInfo[];
    /**
     * The saves cache of current selected instance
     */
    saves: SaveMetadata[];
    /**
     * The game setting of current selected instance
     */
    settings: GameSetting & { resourcePacks: Array<string> };
}

interface Getters {
    /**
     * All selected instances.
     */
    instances: Instance[];
    /**
     * The selected instance config.
     */
    instance: Instance;
    /**
     * The selected instance mapped local version.
     * If there is no local version matced, it will return a local version with folder equal to `"unknown"`.
     */
    instanceVersion: LocalVersion;
    /**
     * The selected instance mapped local java.
     * If there is no matching java for current instance, it will return the `DEFAULT_JAVA`
     * which contains the `majorVersion` equal to 0
     */
    instanceJava: Java;
    /**
     * The selected instance mapped resources to deploy.
     */
    instanceResources: Resource[];
    /**
     * The selected instance mapped minecraft server protocol version.
     * This is determined by the minecraft version of it.
     */
    instanceProtocolVersion: number;
}

interface Mutations {
    instanceAdd: InstanceSchema & { path: string };
    instanceRemove: string;
    instanceJava: string;
    instanceDeployInfo: DeployedInfo[];
    instanceSelect: string;

    /**
     * Edit the profile content. This commit will trigger save function to store the data to the disk.
     * Don't use this directly. Use `editProfile` action
     * @param payload The modified data
     */
    instance: DeepPartial<InstanceSchema> & { path: string };

    /**
     * Update server infos in server.dat
     * @param infos The new server infos
     */
    instanceServerInfos: ServerInfo[];
    /**
     * Update the game settings in options.txt
     * @param payload The new game settings.
     */
    instanceGameSettings: GameSetting;

    // non-persistence mutation below, just update cache, nothing saved

    instanceStatus: ServerStatus;
    instanceCache: { gamesettings: GameSetting } | { serverInfos: ServerInfo[] };
    instanceSaves: SaveMetadata[];

    instancesStatus: { [path: string]: ServerStatus };

    instanceLockFile: any;
}

export type InstanceModule = ModuleOption<State, Getters, Mutations, {}>;

export function createTemplate(): Instance {
    const base: Instance = {
        path: '',
        name: '',

        resolution: { width: 800, height: 400, fullscreen: false },
        minMemory: 0,
        maxMemory: 0,
        vmOptions: [],
        mcOptions: [],

        url: '',
        icon: '',

        showLog: false,
        hideLauncher: true,

        runtime: {
            minecraft: '',
            forge: '',
            liteloader: '',
            fabricLoader: '',
            yarn: '',
        },
        java: '8',
        deployments: {
            mods: [],
        },
        optionalDeployments: [],
        image: '',
        blur: 4,
        server: null,

        author: '',
        description: '',

        lastAccessDate: -1,
        creationDate: -1,
        serverStatus: undefined,
    };
    return base;
}

const DEFAULT_PROFILE: InstanceSchema = createTemplate();

const mod: InstanceModule = {
    state: {
        all: {},
        path: '',

        settings: {
            resourcePacks: [],
        },
        serverInfos: [],
        saves: [],

        java: '',
        deployed: [],
    },
    getters: {
        instances: state => Object.keys(state.all).map(k => state.all[k]),
        instanceProtocolVersion: () => 338,
        instance: state => state.all[state.path] || DEFAULT_PROFILE,
        instanceVersion: (state, getters, rootState) => {
            const current = state.all[state.path] || DEFAULT_PROFILE;
            const requirements = ['minecraft', 'forge', 'fabric-loader', 'yarn', 'liteloader']
                .filter(k => current.runtime[k]);

            const localVersion = rootState.version.local.find(loc => requirements
                .every(name => loc[name] === current.runtime[name]));

            return localVersion || {
                ...current.runtime,
                folder: 'unknown',
            } as any;
        },
        instanceJava: (state, getters, rootState, rootGetter) => {
            const javaPath = state.java;
            if (javaPath && javaPath !== '') {
                return rootState.java.all.find(j => j.path === javaPath) || {
                    path: javaPath,
                    version: '',
                    majorVersion: 0,
                };
            }
            const instance = getters.instance;
            return rootState.java.all.find(j => j.majorVersion.toString() === instance.runtime.java
                || j.version === instance.runtime.java) || rootGetter.defaultJava;
        },
        instanceResources: (state, getters, rootState, rootGetters) => Object.values(getters.instance.deployments).reduce((a, b) => [...a, ...b])
            .map(u => rootGetters.queryResource(u)),
    },
    mutations: {
        instanceAdd(state, instance) {
            /**
             * Prevent the case that hot reload keep the vuex state
             */
            if (!state.all[instance.path]) {
                if (!instance.deployments.resourcepacks) {
                    instance.deployments.resourcepacks = [];
                }
                state.all[instance.path] = { ...instance, serverStatus: undefined };

                // TODO: remove in vue3
                set(state.all, instance.path);
            }
        },
        instanceJava(state, jPath) {
            state.java = jPath;
        },
        instanceDeployInfo(state, info) {
            state.deployed = info;
        },
        instanceRemove(state, id) {
            // TODO: remove in vue3
            remove(state.all, id);
            delete state.all[id];
        },
        instanceSelect(state, id) {
            if (state.all[id]) {
                state.path = id;
            } else if (state.path === '') {
                state.path = Object.keys(state.all)[0];
            }
            state.all[state.path].lastAccessDate = Date.now();
        },
        instanceLockFile(state, lock) {
            state.java = lock.java;
            state.deployed = lock.deployed;
        },
        instance(state, settings) {
            const inst = state.all[settings.path || state.path];

            if (!inst) {
                console.error(`Cannot commit profile. Illegal State with missing profile ${state.path}`);
                return;
            }

            inst.name = typeof settings.name === 'string' ? settings.name : inst.name;

            inst.author = settings.author || inst.author;
            inst.description = settings.description || inst.description;

            if (settings.server) {
                if (inst.server) {
                    inst.server.host = settings.server.host || inst.server.host;
                    inst.server.port = settings.server.port || inst.server.port;
                } else {
                    inst.server = {
                        host: settings.server.host,
                        port: settings.server.port,
                    };
                }
            }

            if (settings.runtime) {
                const versions = settings.runtime;
                if (inst.runtime.minecraft !== settings.runtime.minecraft && typeof versions.minecraft === 'string') {
                    // if minecraft version changed, all other related versions are rest.
                    inst.runtime.minecraft = versions.minecraft;
                    for (const versionType of Object.keys(inst.runtime).filter(v => v !== 'minecraft')) {
                        inst.runtime[versionType] = '';
                    }
                }

                for (const versionType of Object.keys(versions).filter(v => v !== 'minecraft')) {
                    const ver = versions[versionType];
                    if (typeof ver === 'string') {
                        inst.runtime[versionType] = ver;
                    }
                }
            }

            if ('minMemory' in settings && (typeof settings.minMemory === 'number')) {
                inst.minMemory = settings.minMemory;
            }
            if ('maxMemory' in settings && (typeof settings.maxMemory === 'number')) {
                inst.maxMemory = settings.maxMemory;
            }

            if (settings.vmOptions instanceof Array && settings.vmOptions.every(r => typeof r === 'string')) {
                inst.vmOptions = Object.seal(settings.vmOptions);
            }
            if (settings.mcOptions instanceof Array && settings.mcOptions.every(r => typeof r === 'string')) {
                inst.mcOptions = Object.seal(settings.mcOptions);
            }

            inst.url = settings.url || inst.url;
            inst.icon = settings.icon || inst.icon;

            if (typeof settings.deployments === 'object') {
                for (const key of Object.keys(settings.deployments)) {
                    const dep = settings.deployments[key];
                    if (!dep) continue;
                    inst.deployments[key] = dep;
                    // TODO: remove in vue3
                    if (!inst.deployments[key]) {
                        set(state.all, key);
                    }
                }
            }

            if (typeof settings.showLog === 'boolean') {
                inst.showLog = settings.showLog;
            }
            if (typeof settings.hideLauncher === 'boolean') {
                inst.hideLauncher = settings.hideLauncher;
            }

            if (typeof settings.image === 'string') {
                inst.image = settings.image;
            }
            if (typeof settings.blur === 'number') {
                inst.blur = settings.blur;
            }
        },
        instanceCache(state, cache) {
            if ('gamesettings' in cache && cache.gamesettings) {
                let settings = cache.gamesettings;
                let resourcePacks = cache.gamesettings.resourcePacks || [];
                state.settings.resourcePacks = [...resourcePacks];

                state.settings.anaglyph3d = settings.anaglyph3d;
                state.settings.ao = settings.ao;
                state.settings.useVbo = settings.useVbo;
                state.settings.enableVsync = settings.enableVsync;
                state.settings.difficulty = settings.difficulty;
                state.settings.entityShadows = settings.entityShadows;
                state.settings.fboEnable = settings.fboEnable;
                state.settings.fullscreen = settings.fullscreen;
                state.settings.renderDistance = settings.renderDistance;
            } else if ('serverInfos' in cache && cache.serverInfos instanceof Array) {
                state.serverInfos = [...cache.serverInfos];
            }
        },
        instanceGameSettings(state, settings) {
            let container = state.settings as Record<string, any>;
            if (settings.resourcePacks && settings.resourcePacks instanceof Array) {
                container.resourcePacks = [...settings.resourcePacks];
            }
            for (let [key, value] of Object.entries(settings)) {
                if (key in container) {
                    if (typeof value === typeof Reflect.get(container, key)) {
                        container[key] = value;
                        // TODO: remove in vue3
                        set(container, key);
                    }
                } else {
                    container[key] = value;
                    // TODO: remove in vue3
                    set(container, key);
                }
            }
        },
        instanceServerInfos(state, infos) {
            state.serverInfos = infos;
        },
        instanceSaves(state, saves) {
            state.saves = saves;
        },
        instanceStatus(state, status) {
            state.all[state.path].serverStatus = status;
        },
        instancesStatus(state, statues) {
            for (let [path, stat] of Object.entries(statues)) {
                state.all[path].serverStatus = stat;
            }
        },
    },
};

export default mod;
