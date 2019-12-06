import { Forge, LevelDataFrame, LiteLoader, ResourcePack } from '@xmcl/minecraft-launcher-core';
import Vue from 'vue';
import { Modpack } from 'main/service/CurseForgeService';
import { ModuleOption } from '../root';

interface State {
    refreshing: boolean;
    domains: {
        [domain: string]: { [hash: string]: Resource<any> };
        mods: { [hash: string]: ForgeResource | LiteloaderResource };
        resourcepacks: { [hash: string]: ResourcePackResource };
        saves: { [hash: string]: SaveResource };
        modpacks: { [hash: string]: CurseforgeModpackResource };
    };
}

interface Getters {
    domains: string[];
    mods: (ForgeResource | LiteloaderResource)[];
    resourcepacks: ResourcePackResource[];
    saves: SaveResource[];
    modpacks: CurseforgeModpackResource[];

    getResource: (hash: string) => AnyResource | undefined;

    queryResource(payload: string
        | { modid: string; version: string }
        | { fileId: number }
        | { fileId: number; projectId: number }
        | { name: string; version: string }): AnyResource;
}

interface Mutations {
    resource: AnyResource;
    resources: AnyResource[];
    refreshingResource: boolean;
    removeResource: AnyResource;
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

export interface Source {
    path: string;
    /**
     * The date of import
     */
    date: string;
    [key: string]: string | Record<string, string>;
}
export interface Resource<T> {
    /**
     * The name of the resource
     */
    name: string;
    /**
     * The resource file path
     */
    path: string;
    /**
     * The sha1 of the resource
     */
    hash: string;
    /**
     * The suggested ext of the resource
     */
    ext: string;
    /**
     * The resource type. Can be `forge`, `liteloader`, `resourcepack`, and etc.
     */
    type: string;
    /**
     * The domain of the resource. This decide where (which folder) the resource go 
     */
    domain: string | 'mods' | 'resourcepacks' | 'modpacks' | 'saves';
    /**
     * The resource specific metadata
     */
    metadata: T;
    /**
     * Where the resource imported from?
     */
    source: Source;
}

export type AnyResource = Resource<any>;
export type ForgeResource = Resource<Forge.ModMetaData[]> & { type: 'forge' };
export type LiteloaderResource = Resource<LiteLoader.MetaData> & { type: 'liteloader' };
export type ResourcePackResource = Resource<ResourcePack> & { type: 'resourcepack' };
export type CurseforgeModpackResource = Resource<Modpack> & { type: 'curseforge-modpack' };
export type SaveResource = Resource<LevelDataFrame> & { type: 'save' };
export type UnknownResource = Resource<{}> & { type: 'unknown' };

const UNKNOWN_RESOURCE: UnknownResource = {
    metadata: {},
    type: 'unknown',
    domain: 'unknown',
    hash: '',
    ext: '',
    path: '',
    name: '',
    source: {
        path: '',
        date: '',
    },
};

const mod: ResourceModule = {
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
        domains: () => ['mods', 'resourcepacks', 'modpacks', 'saves'],
        mods: state => Object.values(state.domains.mods) || [],
        resourcepacks: state => Object.values(state.domains.resourcepacks) || [],
        saves: state => Object.values(state.domains.saves) || [],
        modpacks: state => Object.values(state.domains.modpacks) || [],
        getResource: state => (hash) => {
            for (const value of [state.domains.mods, state.domains.resourcepacks, state.domains.modpacks, state.domains.saves]) {
                if (value[hash]) return value[hash];
            }
            return undefined;
        },
        queryResource: state => (q) => {
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
                        return UNKNOWN_RESOURCE;
                    case 'resource':
                        for (const domain of Object.values(state.domains)) {
                            if (domain[res[0]]) return domain[res[0]];
                        }
                        break;
                    default:
                        for (const domain of Object.values(state.domains)) {
                            if (domain[qObject]) return domain[qObject];
                        }
                }
            }
            if (typeof qObject !== 'object') return UNKNOWN_RESOURCE;
            if ('modid' in qObject && 'version' in qObject) {
                const { modid, version } = qObject;
                return Object.values(state.domains.mods)
                    .filter(m => m.type === 'forge')
                    .find(m => (m.metadata instanceof Array ? (m.metadata.some(me => me.modid === modid && me.version === version)) : false)) 
                    || UNKNOWN_RESOURCE;
            }
            if ('name' in qObject && 'version' in qObject) {
                const { name, version } = qObject;
                return Object.values(state.domains.mods)
                    .filter(m => m.type === 'forge')
                    .find(m => ('version' in m.metadata ? (m.metadata.name === name && m.metadata.version === version) : false))
                    || UNKNOWN_RESOURCE;
            }
            if ('fileId' in qObject) {
                const id = qObject.fileId;
                for (const domain of Object.values(state.domains)) {
                    const found = Object.values(domain)
                        .find(r => 'curseforge' in r.source
                            && typeof r.source.curseforge === 'object'
                            && r.source.curseforge.fileId === id.toString());
                    if (found) return found;
                }
            }
            return UNKNOWN_RESOURCE;
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
