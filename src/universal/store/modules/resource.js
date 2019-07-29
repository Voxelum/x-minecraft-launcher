import Vue from 'vue';

/**
 * @type {import('./resource').ResourceModule}
 */
const mod = {
    state: {
        refreshing: false,
        mods: {},
        resourcepacks: {},
        saves: {},
        modpacks: {},
    },
    getters: {
        domains: _ => ['mods', 'resourcepacks', 'modpacks', 'saves'],
        mods: state => Object.values(state.mods) || [],
        resourcepacks: state => Object.values(state.resourcepacks) || [],
        saves: state => Object.values(state.saves) || [],
        modpacks: state => Object.values(state.modpacks) || [],
        getResource: (state, getters) => (hash) => {
            for (const value of [state.mods, state.resourcepacks, state.modpacks, state.saves]) {
                if (value[hash]) return value[hash];
            }
            return undefined;
        },
    },
    mutations: {
        refreshingResource(state, s) {
            state.refreshing = s;
        },
        resource: (state, res) => {
            switch (res.domain) {
                case 'mods':
                case 'resourcepacks':
                case 'saves':
                case 'modpacks':
                    Vue.set(state[res.domain], res.hash, res);
                    break;
                default:
                    console.error(`Cannot accept resource for unknown domain [${res.domain}]`);
            }
        },
        resources: (state, all) => {
            for (const res of all) {
                switch (res.domain) {
                    case 'mods':
                    case 'resourcepacks':
                    case 'saves':
                    case 'modpacks':
                        Vue.set(state[res.domain], res.hash, res);
                        break;
                    default:
                        console.error(`Cannot accept resource for unknown domain [${res.domain}]`);
                }
            }
        },
        removeResource(state, resource) {
            switch (resource.domain) {
                case 'mods':
                case 'resourcepacks':
                case 'saves':
                case 'modpacks':
                    Vue.delete(state[resource.domain], resource.hash);
                    break;
                default:
                    console.error(`Cannot remove resource for unknown domain [${resource.domain}]`);
            }
        },
    },
};

export default mod;
