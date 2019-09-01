import Vue from 'vue';

/**
 * @type {import('./resource').ResourceModule}
 */
const mod = {
    state: {
        refreshing: false,
        domains: {
            mods: {},
            resourcepacks: {},
            saves: {},
            modpacks: {},
        },
    },
    getters: {
        domains: _ => ['mods', 'resourcepacks', 'modpacks', 'saves'],
        mods: state => Object.values(state.domains.mods) || [],
        resourcepacks: state => Object.values(state.domains.resourcepacks) || [],
        saves: state => Object.values(state.domains.saves) || [],
        modpacks: state => Object.values(state.domains.modpacks) || [],
        getResource: (state, getters) => (hash) => {
            for (const value of [state.domains.mods, state.domains.resourcepacks, state.domains.modpacks, state.domains.saves]) {
                if (value[hash]) return value[hash];
            }
            return undefined;
        },
        queryResource: (state, getters) => (q) => {
            let qObject = q;
            if (typeof qObject === 'string') {
                const [host, ...res] = qObject.split('/');
                switch (host) {
                    case 'forge':
                        qObject = { modid: res[0], version: res[1] };
                        break;
                    case 'curseforge':
                        qObject = res.length === 2 ? { projectId: Number.parseInt(res[0], 10), fileId: Number.parseInt(res[1], 10) } : { fileId: Number.parseInt(res[0], 10) };
                        break;
                    case 'liteloader':
                        qObject = { name: res[0], version: res[1] };
                        break;
                    case 'file':
                        return undefined;
                    default:
                        for (const domain of Object.values(state.domains)) {
                            if (domain[qObject]) return domain[qObject];
                        }
                }
            }
            if (typeof qObject !== 'object') return undefined;
            if ('modid' in qObject && 'version' in qObject) {
                return Object.values(state.domains.mods)
                    .filter(m => m.type === 'forge')
                    // eslint-disable-next-line
                    .find(m => m.metadata instanceof Array ? (m.metadata.some(me => me.modid === qObject.modid && me.version === qObject.version)) : false);
            }
            if ('name' in qObject && 'version' in qObject) {
                return Object.values(state.domains.mods)
                    .filter(m => m.type === 'forge')
                    // eslint-disable-next-line
                    .find(m => 'version' in m.metadata ? (m.metadata.name === qObject.name && m.metadata.version === qObject.version) : false);
            }
            if ('fileId' in qObject) {
                for (const domain of Object.values(state.domains)) {
                    const found = Object.values(domain)
                        .find(r => 'curseforge' in r.source
                            && typeof r.source.curseforge === 'object'
                            && r.source.curseforge.fileId === qObject.fileId.toString());
                    if (found) return found;
                }
            }
            return undefined;
        },
    },
    mutations: {
        refreshingResource(state, s) {
            state.refreshing = s;
        },
        resource: (state, res) => {
            if (res.domain in state.domains) {
                Vue.set(state.domains[res.domain], res.hash, Object.freeze(res));
            } else {
                console.error(`Cannot accept resource for unknown domain [${res.domain}]`);
            }
        },
        resources: (state, all) => {
            console.log(`Accept resource ${all.length}`);
            for (const res of all) {
                if (res.domain in state.domains) {
                    const domain = state.domains[res.domain];
                    if (!domain[res.hash]) {
                        Vue.set(domain, res.hash, Object.freeze(res));
                    } else {
                        domain[res.hash] = Object.freeze(res);
                    }
                } else {
                    console.error(`Cannot accept resource for unknown domain [${res.domain}]`);
                }
            }
        },
        removeResource(state, resource) {
            if (resource.domain in state.domains) {
                Vue.delete(state.domains[resource.domain], resource.hash);
            } else {
                console.error(`Cannot remove resource for unknown domain [${resource.domain}]`);
            }
        },
    },
};

export default mod;
