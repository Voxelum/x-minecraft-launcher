import { Modpack } from '@main/service/CurseForgeService';
import { requireString } from '@universal/util/assert';
import { Forge, LiteLoader } from '@xmcl/mod-parser';
import { ResourcePack } from '@xmcl/resourcepack';
import { LevelDataFrame } from '@xmcl/world';
import Vue from 'vue';
import { ModuleOption } from '../root';
import { ResourceSchema } from './resource.schema';

interface State {
    domains: {
        [domain: string]: Resource<any>[];
        mods: Array<ForgeResource | LiteloaderResource>;
        resourcepacks: ResourcePackResource[];
        saves: SaveResource[];
        modpacks: CurseforgeModpackResource[];
    };
    directory: {
        [hash: string]: AnyResource;
    };

}

interface Getters {
    /**
     * All the deployable domains
     */
    domains: string[];
    /**
     * Get the resource by resource hash
     */
    getResource: (hash: string) => AnyResource;
    /**
     * Query local resource by uri
     * @param uri The uri
     */
    queryResource(uri: string): AnyResource;
}

interface Mutations {
    resource: AnyResource;
    resources: AnyResource[];
    resourceRemove: AnyResource;
}


export type ResourceModule = ModuleOption<State, Getters, Mutations, {}>;
export type ImportTypeHint = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save';
export type ImportOption = {
    /**
     * The real file path of the resource
     */
    path: string;
    /**
     * The hint for the import file type
     */
    type?: ImportTypeHint;
    /**
     * The extra info you want to provide to the source of the resource
     */
    metadata?: any;
    background?: boolean;
}

export type Resource<T> = ResourceSchema & { metadata: T };
export type AnyResource = Resource<any>;
export type ForgeResource = Resource<Forge.ModMetaData[]> & { type: 'forge' };
export type LiteloaderResource = Resource<LiteLoader.MetaData> & { type: 'liteloader' };
export type ResourcePackResource = Resource<ResourcePack> & { type: 'resourcepack' };
export type CurseforgeModpackResource = Resource<Modpack> & { type: 'curseforge-modpack' };
export type SaveResource = Resource<LevelDataFrame> & { type: 'save' };
export type UnknownResource = Resource<{}> & { type: 'unknown' };

export const UNKNOWN_RESOURCE: UnknownResource = {
    metadata: {},
    type: 'unknown',
    domain: 'unknown',
    hash: '',
    ext: '',
    path: '',
    name: '',
    source: {
        uri: [],
        date: 0,
    },
};

const mod: ResourceModule = {
    state: {
        domains: {
            mods: [],
            resourcepacks: [],
            saves: [],
            modpacks: [],
            unknown: [],
        },
        directory: {},
    },
    getters: {
        domains: () => ['mods', 'resourcepacks', 'modpacks', 'saves', 'unknown'],
        getResource: state => hash => state.directory[hash] || UNKNOWN_RESOURCE,
        queryResource: state => (url) => {
            requireString(url);
            for (const d of Object.keys(state.domains)) {
                const res = state.domains[d];
                for (const v of res) {
                    const uris = v.source.uri;
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
                domain.push(Object.freeze(res));
                state.directory[res.hash] = res;
                for (const u of res.source.uri) {
                    state.directory[u] = res;
                }
            } else {
                console.error(`Cannot accept resource for unknown domain [${res.domain}]`);
            }
        },
        resources: (state, all) => {
            console.log(`Accept resource ${all.length}`);
            for (const res of all) {
                if (res.domain in state.domains) {
                    const domain = state.domains[res.domain];
                    domain.push(Object.freeze(res));
                    state.directory[res.hash] = res;
                    for (const u of res.source.uri || []) {
                        state.directory[u] = res;
                    }
                } else {
                    console.error(`Cannot accept resource for unknown domain [${res.domain}]`);
                }
            }
        },
        resourceRemove(state, resource) {
            if (resource.domain in state.domains) {
                const domain = state.domains[resource.domain];
                const index = domain.findIndex(r => r.hash === resource.hash);
                if (index === -1) {
                    console.warn(`Cannot find resouce ${resource.name}[${resource.hash}] in domain!`);
                }
                Vue.delete(domain, index);
                Vue.delete(state.directory, resource.hash);
                for (const u of resource.source.uri) {
                    Vue.delete(state.directory, u);
                }
            } else {
                console.error(`Cannot remove resource for unknown domain [${resource.domain}]`);
            }
        },
    },
};

export default mod;
