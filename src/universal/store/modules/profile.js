import Vue from 'vue';
import { getExpectVersion } from 'universal/utils/versions';
import { UNKNOWN_STATUS } from 'universal/utils/server-status';

/**
 * @type {import('./profile').TemplateFunction}
 */
export function createTemplate(id, java, mcversion, type = 'modpack') {
    console.log(`Template from ${type}`);
    /**
     * @type {import('./profile').ProfileModule.ProfileBase}
     */
    const base = {
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
    };
    if (type === 'modpack') {
        /**
        * @type {import('./profile').ProfileModule.Profile}
         */
        const modpack = {
            author: '',
            description: '',
            ...base,
            type: 'modpack',
        };
        return modpack;
    }
    /**
     * @type {import('./profile').ProfileModule.ServerProfile}
     */
    const server = {
        host: '',
        port: 0,
        ...base,
        type: 'server',
    };
    return server;
}

/**
 * @type {import('./profile').ProfileModule}
 */
const mod = {
    state: {
        all: {},
        id: '',

        status: UNKNOWN_STATUS,

        settings: {
            resourcePacks: [],
        },
        serverInfos: [],
        saves: [],

        refreshing: false,
        problems: [],

        dirty: {
            servers: false,
            saves: false,
        },
    },
    getters: {
        profiles: state => Object.keys(state.all).map(k => state.all[k]),
        serverProtocolVersion: state => 338,
        selectedProfile: state => state.all[state.id],
        currentVersion: (state, getters, rootState) => {
            const current = state.all[state.id];
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
        },
        profile(state, settings) {
            const prof = state.all[state.id];

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

            prof.java = settings.java || prof.java;
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
            state.status = status;
        },
        refreshingProfile(state, refreshing) {
            state.refreshing = refreshing;
        },
        profileSaves(state, saves) {
            state.saves = saves;
        },
        profileProblems(state, problems) {
            state.problems = problems;
        },
        markDirty(state, { dirty, target }) {
            state.dirty[target] = dirty;
        },
    },
};

export default mod;
