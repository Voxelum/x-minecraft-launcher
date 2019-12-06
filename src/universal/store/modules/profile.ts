import { GameSetting, Server, LevelDataFrame } from '@xmcl/minecraft-launcher-core';
import { getExpectVersion } from 'universal/utils/versions';
import Vue from 'vue';
import { ModuleOption } from '../root';
import { Java } from './java';
import { ModpackProfileConfig, ProfileConfig, ServerProfileConfig } from './profile.config';
import { Resource } from './resource';
import { LocalVersion } from './version';

export type CreateProfileOption = Omit<ModpackProfileConfig, 'id' | 'lastAccessDate' | 'creationDate'> & { type: 'modpack' }
export type CreateServerProfileOption = Omit<ServerProfileConfig, 'id' | 'lastAccessDate' | 'creationDate'> & { type: 'server' }
export type CreateOption = Omit<DeepPartial<ModpackProfileConfig & ServerProfileConfig>, 'id' | 'lastAccessDate' | 'creationDate' | 'type'> & { type: 'modpack' | 'server' };
export type ServerOrModpack = ModpackProfileConfig | ServerProfileConfig;
export type ServerAndModpack = ModpackProfileConfig & ServerProfileConfig & { type: 'modpack' | 'server' };

export type Save = { level: LevelDataFrame; path: string }


interface State {
    /**
     * All loaded launch profiles
     */
    all: { [id: string]: ServerOrModpack };

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
     * The instance currently lock the profile
     */
    refreshing: number;
    /**
     * The server statuses of all server profiles, modpack won't have this.
     */
    statuses: { [id: string]: Server.StatusFrame | undefined };
}

interface Getters {
    profiles: ServerOrModpack[];
    serverProtocolVersion: number;
    selectedProfile: ServerOrModpack;
    currentVersion: LocalVersion;
    deployingResources: { [domain: string]: Resource<any>[] };
    /**
     * If current launcher is refreshing the profile data
     */
    refreshing: boolean;
}

interface Mutations {
    addProfile: ProfileConfig;
    removeProfile: string;
    selectProfile: string;

    /**
     * Edit the profile content. This commit will trigger save function to store the data to the disk.
     * Don't use this directly. Use `editProfile` action
     * @param payload The modified data
     */
    profile: DeepPartial<ServerAndModpack>;

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

    aquireProfile: (state: State) => void;
    releaseProfile: (state: State) => void;
}

export type ProfileModule = ModuleOption<State, Getters, Mutations, {}>;

export function createTemplate(id: string, java: Java, mcversion: string, type: 'modpack' | 'server', isCreatingNew: boolean): ServerOrModpack {
    const base: ProfileConfig = {
        id,
        name: '',

        resolution: { width: 800, height: 400, fullscreen: false },
        java,
        minMemory: undefined,
        maxMemory: undefined,
        vmOptions: [],
        mcOptions: [],

        type,
        url: '',
        icon: '',

        showLog: false,
        hideLauncher: true,

        version: {
            minecraft: mcversion,
            forge: '',
            liteloader: '',
        },
        deployments: {
            mods: [],
        },
        image: '',
        blur: 4,

        lastAccessDate: -1,
        creationDate: isCreatingNew ? Date.now() : -1,
    };
    if (type === 'modpack') {
        const modpack: ModpackProfileConfig = {
            author: '',
            description: '',
            ...base,
            type: 'modpack',
        };
        return modpack;
    }
    const server: ServerProfileConfig = {
        host: '',
        port: 0,
        ...base,
        type: 'server',
    };
    return server;
}

const DEFAULT_PROFILE: ProfileConfig = createTemplate('', { majorVersion: 8, path: '', version: '' }, '', 'modpack', false);

const mod: ProfileModule = {
    state: {
        all: {},
        id: '',

        settings: {
            resourcePacks: [],
        },
        serverInfos: [],
        saves: [],

        refreshing: 0,
        statuses: {},
    },
    getters: {
        profiles: state => Object.keys(state.all).map(k => state.all[k]),
        serverProtocolVersion: () => 338,
        selectedProfile: state => state.all[state.id] || DEFAULT_PROFILE,
        currentVersion: (state, getters) => {
            const current = getters.selectedProfile;
            const minecraft = current.version.minecraft;
            const forge = current.version.forge;
            const liteloader = current.version.liteloader;

            return {
                id: getExpectVersion(minecraft, forge, liteloader),
                minecraft,
                forge,
                liteloader,
                folder: getExpectVersion(minecraft, forge, liteloader),
            };
        },
        refreshing(state) { return state.refreshing > 0; },
        deployingResources: (_, getters, rootState) => {
            const profile = getters.selectedProfile;

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
        profile(state, settings) {
            const prof = state.all[state.id];

            if (!prof) {
                console.error(`Cannot commit profile. Illegal State with missing profile ${state.id}`);
                return;
            }

            prof.name = typeof settings.name === 'string' ? settings.name : prof.name;

            if (prof.type === 'modpack') {
                prof.author = settings.author || prof.author;
                prof.description = settings.description || prof.description;
            } else {
                prof.host = settings.host || prof.host;
                prof.port = settings.port || prof.port;
            }

            if (settings.version) {
                const versions = settings.version;
                if (prof.version.minecraft !== settings.version.minecraft && typeof versions.minecraft === 'string') {
                    // if minecraft version changed, all other related versions are rest.
                    prof.version.minecraft = versions.minecraft;
                    for (const versionType of Object.keys(prof.version).filter(v => v !== 'minecraft')) {
                        prof.version[versionType] = '';
                    }
                }

                for (const versionType of Object.keys(versions).filter(v => v !== 'minecraft')) {
                    const ver = versions[versionType];
                    if (typeof ver === 'string') {
                        prof.version[versionType] = ver;
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

            prof.java = settings.java || prof.java as any; // TODO: typecheck
            if (prof.java && !prof.java.path) {
                Reflect.deleteProperty(prof, 'java');
            }

            prof.url = settings.url || prof.url;
            prof.icon = settings.icon || prof.icon;

            if (typeof settings.deployments === 'object') {
                const deployments = settings.deployments;
                for (const domain of Object.keys(deployments)) {
                    const resources = deployments[domain];
                    if (resources instanceof Array && resources.every(r => typeof r === 'string')) {
                        prof.deployments[domain] = resources;
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
        aquireProfile(state) {
            state.refreshing++;
        },
        releaseProfile(state) {
            state.refreshing--;
        },
    },
};

export default mod;
