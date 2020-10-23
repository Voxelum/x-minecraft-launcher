import { Resource, ForgeResource, LiteloaderResource, FabricResource, ResourcePackResource, SaveResource, ModpackResource, CurseforgeModpackResource, UNKNOWN_RESOURCE, Resources } from '@universal/entities/resource';
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
    resourceRemove: Resources;
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
        resourceRemove(state, resource) {
            if (resource.domain in state.domains) {
                const domain = state.domains[resource.domain];
                const index = domain.findIndex(r => r.hash === resource.hash);
                if (index === -1) {
                    throw new Error(`Cannot find resouce ${resource.name}[${resource.hash}] in domain!`);
                }
                domain.splice(index, 1);

                // TODO: remove in Vue3
                remove(domain, index);
            } else {
                throw new Error(`Cannot remove resource for unknown domain [${resource.domain}]`);
            }
        },
    },
};

export default mod;
