import { GameSetting, Server, LevelDataFrame } from '@xmcl/minecraft-launcher-core';
import { getExpectVersion } from 'universal/utils/versions';
import Vue from 'vue';
import { ModuleOption } from '../root';
import { Java } from './java';
import { InstanceConfig, InstanceLockConfig } from './instance.config';
import { Resource } from './resource';
import { LocalVersion } from './version';

export type CreateOption = DeepPartial<Omit<InstanceConfig, 'id' | 'lastAccessDate' | 'creationDate'>>;
export type Save = { level: LevelDataFrame; path: string }
export { InstanceConfig };

interface State extends InstanceLockConfig {
    /**
     * All loaded launch profiles
     */
    all: { [id: string]: InstanceConfig };

    /**
     * Current selected id
     */
    id: string;

    // caches
    /**
     * Loaded server dat info 
     */
    serverInfos: Server.Info[];
    /**
     * The saves cache of current selected profile
     */
    saves: Save[];
    /**
     * The game setting of current selected profile
     */
    settings: GameSetting.Frame & { resourcePacks: Array<string> };
    /**
     * The server statuses of all server profiles, modpack won't have this.
     */
    statuses: { [id: string]: Server.StatusFrame | undefined };
}

interface Getters {
    instances: InstanceConfig[];
    serverProtocolVersion: number;
    selectedInstance: InstanceConfig;
    currentVersion: LocalVersion;
    deployingResources: { [domain: string]: Resource<any>[] };
}

interface Mutations {
    addProfile: InstanceConfig;
    removeProfile: string;
    selectProfile: string;

    /**
     * Edit the profile content. This commit will trigger save function to store the data to the disk.
     * Don't use this directly. Use `editProfile` action
     * @param payload The modified data
     */
    profile: DeepPartial<InstanceConfig>;

    /**
     * Update server infos in server.dat
     * @param infos The new server infos
     */
    serverInfos: Server.Info[];
    /**
     * Update the game settings in options.txt
     * @param payload The new game settings.
     */
    gamesettings: GameSetting.Frame;

    // non-persistence mutation below, just update cache, nothing saved

    profileCache: { gamesettings?: GameSetting.Frame } | { serverInfos: Server.Info[] };
    serverStatus: Server.StatusFrame;
    profileSaves: Save[];
    profileStatus: { [id: string]: Server.StatusFrame };

    lockFile: any;
}

export type InstanceModule = ModuleOption<State, Getters, Mutations, {}>;

export function createTemplate(id: string, mcversion: string, isCreatingNew: boolean): InstanceConfig {
    const base: InstanceConfig = {
        id,
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
            minecraft: mcversion,
            forge: '',
            liteloader: '',
            java: '8',
            fabric: '',
        },
        deployments: {
            mods: {},
        },
        optionalDeployments: {
        },
        image: '',
        blur: 4,

        author: '',
        description: '',

        lastAccessDate: -1,
        creationDate: isCreatingNew ? Date.now() : -1,
    };
    return base;
}

const DEFAULT_PROFILE: InstanceConfig = createTemplate('', '', false);

const mod: InstanceModule = {
    state: {
        all: {},
        id: '',
        settings: {
            resourcePacks: [],
        },
        serverInfos: [],
        saves: [],

        java: '',
        deployed: {},

        statuses: {},
    },
    getters: {
        instances: state => Object.keys(state.all).map(k => state.all[k]),
        serverProtocolVersion: () => 338,
        selectedInstance: state => state.all[state.id] || DEFAULT_PROFILE,
        currentVersion: (state, getters) => {
            const current = getters.selectedInstance;
            const minecraft = current.runtime.minecraft;
            const forge = current.runtime.forge;
            const liteloader = current.runtime.liteloader;

            return {
                id: getExpectVersion(minecraft, forge, liteloader),
                minecraft,
                forge,
                liteloader,
                folder: getExpectVersion(minecraft, forge, liteloader),
            };
        },
        deployingResources: (_, getters, rootState) => {
            const profile = getters.selectedInstance;

            const resources: { [domain: string]: Resource<any>[] } = {};
            for (const domain of Object.keys(profile.deployments)) {
                const depl = profile.deployments[domain];
                if (depl instanceof Array && depl.length !== 0) {
                    const domainResources = rootState.resource.domains[domain];
                    resources[domain] = depl.map(h => domainResources[h]);
                }
            }

            return resources;
        },
    },
    mutations: {
        addProfile(state, profile) {
            /**
             * Prevent the case that hot reload keep the vuex state
             */
            if (!state.all[profile.id]) {
                Vue.set(state.all, profile.id, profile);
            }
        },
        removeProfile(state, id) {
            Vue.delete(state.all, id);
        },
        selectProfile(state, id) {
            if (state.all[id]) {
                state.id = id;
            } else if (state.id === '') {
                state.id = Object.keys(state.all)[0];
            }
            state.all[state.id].lastAccessDate = Date.now();
        },
        lockFile(state, lock) {
            state.java = lock.java;
            state.deployed = lock.deployed;
        },
        profile(state, settings) {
            const prof = state.all[state.id];

            if (!prof) {
                console.error(`Cannot commit profile. Illegal State with missing profile ${state.id}`);
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
                const deployments = settings.deployments;
                for (const domain of Object.keys(deployments)) {
                    const resources = deployments[domain];
                    if (typeof resources === 'object') {
                        for (const key of Object.keys(resources)) {
                            const value = resources[key];
                            if (value) {
                                prof.deployments[domain][key] = value;
                            }
                        }
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

        profileCache(state, cache) {
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

        gamesettings(state, settings) {
            console.log(`GameSetting ${JSON.stringify(settings, null, 4)}`);
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
        },
        serverInfos(state, infos) {
            state.serverInfos = infos;
        },
        serverStatus(state, status) {
            Vue.set(state.statuses, state.id, status);
        },
        profileStatus(state, statues) {
            for (const [key, value] of Object.entries(statues)) {
                Vue.set(state.statuses, key, value);
            }
        },
        profileSaves(state, saves) {
            state.saves = saves;
        },
    },
};

export default mod;
