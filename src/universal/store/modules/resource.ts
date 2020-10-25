import { CurseforgeModpackResource, FabricResource, ForgeResource, LiteloaderResource, ModpackResource, Resource, ResourcePackResource, Resources, SaveResource, UNKNOWN_RESOURCE } from '@universal/entities/resource';
import { requireString } from '@universal/util/assert';
import { remove } from '@universal/util/middleware';
import { ModuleOption } from '../root';

interface State {
    domains: {
        [domain: string]: Array<Resources>;
        mods: Array<ForgeResource | LiteloaderResource | FabricResource>;
        resourcepacks: Array<ResourcePackResource>;
        saves: Array<SaveResource>;
        modpacks: Array<ModpackResource | CurseforgeModpackResource>;
    };
}

interface Getters {
    /**
     * Query local resource by uri
     * @param uri The uri
     */
    queryResource(uri: string): Resource;
}

interface Mutations {
    resource: Resources;
    resources: Resources[];
    resourcesRemove: Resource[];
}


export type ResourceModule = ModuleOption<State, Getters, Mutations, {}>;

const mod: ResourceModule = {
    state: {
        domains: {
            mods: [],
            resourcepacks: [],
            saves: [],
            modpacks: [],
            unknown: [],
        },
    },
    getters: {
        queryResource: state => (url) => {
            requireString(url);
            for (const domain of Object.keys(state.domains)) {
                const resources = state.domains[domain];
                for (const v of resources) {
                    const uris = v.uri;
                    if (uris.some(u => u === url)) {
                        return v;
                    }
                }
            }
            return UNKNOWN_RESOURCE;
        },
    },
    mutations: {
        resource: (state, res) => {
            if (res.domain in state.domains) {
                const domain = state.domains[res.domain];
                domain.push(Object.freeze(res) as any);
            } else {
                throw new Error(`Cannot accept resource for unknown domain [${res.domain}]`);
            }
        },
        resources: (state, all) => {
            for (const res of all) {
                if (res.domain in state.domains) {
                    const domain = state.domains[res.domain];
                    domain.push(Object.freeze(res) as any);
                } else {
                    throw new Error(`Cannot accept resource for unknown domain [${res.domain}]`);
                }
            }
        },
        resourcesRemove(state, resources) {
            const removal = new Set(resources.map((r) => r.hash));
            const domains = new Set(resources.map((r) => r.domain));
            for (const domain of domains) {
                state.domains[domain] = state.domains[domain].filter((r) => !removal.has(r.hash)) as any;
            }
        },
    },
};

export default mod;
