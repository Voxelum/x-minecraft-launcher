import { getExpectVersion } from '@universal/util/version';
import { Status as ServerStatus } from '@xmcl/client';
import { Frame as GameSetting } from '@xmcl/gamesetting';
import { ServerInfo } from '@xmcl/server-info';
import { LevelDataFrame } from '@xmcl/world';
import Vue from 'vue';
import { ModuleOption } from '../root';
import { DeployedInfo, InstanceLockSchema, InstanceSchema } from './instance.schema';
import { DEFAULT_JAVA, Java } from './java';
import { Resource } from './resource';
import { LocalVersion } from './version';

export type CreateOption = DeepPartial<Omit<InstanceSchema, 'id' | 'lastAccessDate' | 'creationDate'>>;
export type Save = { level: LevelDataFrame; path: string }
export { InstanceSchema as InstanceConfig };

interface Instance extends InstanceSchema {
    path: string;

    /**
     * The server status
     */
    serverStatus: ServerStatus | null;
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
    saves: Save[];
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
    instanceResources: Resource<any>[];
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
    instanceSaves: Save[];

    instancesStatus: { [path: string]: ServerStatus };

    instanceLockFile: any;
}

export type InstanceModule = ModuleOption<State, Getters, Mutations, {}>;

export function createTemplate(): Instance {
    const base: Instance = {
        path: '',
        name: '',

        resolution: { width: 800, height: 400, fullscreen: false },
        minMemory: undefined,
        maxMemory: undefined,
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
            'fabric-loader': '',
            yarn: '',
        },
        java: '8',
        deployments: {
            mods: [],
        },
        optionalDeployments: [],
        image: '',
        blur: 4,

        author: '',
        description: '',

        lastAccessDate: -1,
        creationDate: -1,
        serverStatus: null,
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
            const current = getters.instance;
            const runtimes = Object.keys(current.runtime);

            const localVersion = rootState.version.local
                .find(v => runtimes.every(r => ((v as any)[r] ? (v as any)[r] === current.runtime[r] : true)));

            return localVersion || {
                id: getExpectVersion(current.runtime.minecraft, current.runtime.forge, current.runtime.liteloader),
                folder: 'unknown',
                ...current.runtime,
            } as any;
        },
        instanceJava: (state, getters, rootState) => {
            const javaPath = state.java;
            if (javaPath !== '') {
                return rootState.java.all.find(j => j.path === javaPath) || {
                    path: javaPath,
                    version: '',
                    majorVersion: 0,
                };
            }
            const instance = getters.instance;
            return rootState.java.all.find(j => j.majorVersion.toString() === instance.runtime.java
                || j.version === instance.runtime.java) || DEFAULT_JAVA;
        },
        instanceResources: (state, getters, rootState, rootGetters) => Object.values(getters.instance.deployments).reduce((a, b) => [...a, ...b])
            .map(u => rootGetters.queryResource(u)),
    },
    mutations: {
        instanceAdd(state, profile) {
            /**
             * Prevent the case that hot reload keep the vuex state
             */
            if (!state.all[profile.path]) {
                Vue.set(state.all, profile.path, profile);
            }
        },
        instanceJava(state, jPath) {
            state.java = jPath;
        },
        instanceDeployInfo(state, info) {
            state.deployed = info;
        },
        instanceRemove(state, id) {
            Vue.delete(state.all, id);
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
            const prof = state.all[settings.path || state.path];

            if (!prof) {
                console.error(`Cannot commit profile. Illegal State with missing profile ${state.path}`);
                return;
            }

            prof.name = typeof settings.name === 'string' ? settings.name : prof.name;

            prof.author = settings.author || prof.author;
            prof.description = settings.description || prof.description;

            if (settings.server) {
                if (prof.server) {
                    prof.server.host = settings.server.host || prof.server.host;
                    prof.server.port = settings.server.port || prof.server.port;
                } else {
                    prof.server = {
                        host: settings.server.host,
                        port: settings.server.port,
                    };
                }
            }

            if (settings.runtime) {
                const versions = settings.runtime;
                if (prof.runtime.minecraft !== settings.runtime.minecraft && typeof versions.minecraft === 'string') {
                    // if minecraft version changed, all other related versions are rest.
                    prof.runtime.minecraft = versions.minecraft;
                    for (const versionType of Object.keys(prof.runtime).filter(v => v !== 'minecraft')) {
                        prof.runtime[versionType] = '';
                    }
                }

                for (const versionType of Object.keys(versions).filter(v => v !== 'minecraft')) {
                    const ver = versions[versionType];
                    if (typeof ver === 'string') {
                        prof.runtime[versionType] = ver;
                    }
                }
            }

            if ('minMemory' in settings && (typeof settings.minMemory === 'number' || typeof settings.minMemory === 'undefined')) {
                prof.minMemory = settings.minMemory;
            }
            if ('maxMemory' in settings && (typeof settings.maxMemory === 'number' || typeof settings.maxMemory === 'undefined')) {
                prof.maxMemory = settings.maxMemory;
            }

            if (settings.vmOptions instanceof Array && settings.vmOptions.every(r => typeof r === 'string')) {
                prof.vmOptions = Object.seal(settings.vmOptions);
            }
            if (settings.mcOptions instanceof Array && settings.mcOptions.every(r => typeof r === 'string')) {
                prof.mcOptions = Object.seal(settings.mcOptions);
            }

            prof.url = settings.url || prof.url;
            prof.icon = settings.icon || prof.icon;

            if (typeof settings.deployments === 'object') {
                for (const key of Object.keys(settings.deployments)) {
                    const dep = settings.deployments[key];
                    if (dep) {
                        prof.deployments[key] = dep;
                    }
                }
            }

            if (typeof settings.showLog === 'boolean') {
                prof.showLog = settings.showLog;
            }
            if (typeof settings.hideLauncher === 'boolean') {
                prof.hideLauncher = settings.hideLauncher;
            }

            if (typeof settings.image === 'string') {
                prof.image = settings.image;
            }
            if (typeof settings.blur === 'number') {
                prof.blur = settings.blur;
            }
        },
        instanceCache(state, cache) {
            if ('gamesettings' in cache && cache.gamesettings) {
                const settings = cache.gamesettings;
                const container = state.settings;
                if (settings.resourcePacks && settings.resourcePacks instanceof Array) {
                    Vue.set(container, 'resourcePacks', [...settings.resourcePacks]);
                }
                for (const [key, value] of Object.entries(settings)) {
                    if (key in container) {
                        if (typeof value === typeof Reflect.get(container, key)) {
                            Vue.set(container, key, value);
                        }
                    } else {
                        Vue.set(container, key, value);
                    }
                }
            }
        },
        instanceGameSettings(state, settings) {
            let container = state.settings;
            if (settings.resourcePacks && settings.resourcePacks instanceof Array) {
                Vue.set(container, 'resourcePacks', [...settings.resourcePacks]);
            }
            for (let [key, value] of Object.entries(settings)) {
                if (key in container) {
                    if (typeof value === typeof Reflect.get(container, key)) {
                        Vue.set(container, key, value);
                    }
                } else {
                    Vue.set(container, key, value);
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
