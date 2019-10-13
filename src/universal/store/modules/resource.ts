import Vue from 'vue';
import { Context, Module } from "..";
import { Forge, LiteLoader, ResourcePack, World } from "@xmcl/minecraft-launcher-core";

export declare namespace ResourceModule {
    interface State {
        refreshing: boolean;
        domains: {
            [domain: string]: { [hash: string]: Resource<any> };
            mods: { [hash: string]: ForgeResource | LiteloaderResource };
            resourcepacks: { [hash: string]: ResourcePackResource };
            saves: { [hash: string]: SaveResource };
            modpacks: { [hash: string]: CurseforgeModpackResource };
        }
    }
    interface Getters {
        domains: string[];
        mods: (ForgeResource | LiteloaderResource)[];
        resourcepacks: ResourcePackResource[];
        saves: SaveResource[];
        modpacks: CurseforgeModpackResource[];

        getResource(hash: string): AnyResource | undefined;

        queryResource(payload: string
            | { modid: string; version: string; }
            | { fileId: number; }
            | { fileId: number; projectId: number }
            | { name: string; version: string; }): AnyResource | undefined;
    }

    interface Mutations {
        resource(state: State, resource: AnyResource): void;
        resources(state: State, resources: AnyResource[]): void;
        refreshingResource(state: State, refresh: boolean): void;
        removeResource(state: State, resource: AnyResource): void;
    }
    type C = Context<State, Getters>;

    interface Actions {
        /**
         * Rescan the local resources files' metadata. This will update the resource's metadata if the resource is modified.
         */
        refreshResources(context: C): Promise<void>;
        /**
         * Deploy all the resource from `resourceUrls` into profile which uuid equals to `profile`.
         * 
         * The `mods` and `resourcepacks` will be deploied by linking the mods & resourcepacks files into the `mods` and `resourcepacks` directory of the profile.
         * 
         * The `saves` and `modpack` will be deploied by pasting the saves and modpack overrides into this profile directory.
         */
        deployResources(context: C, payload: { resourceUrls: string[], profile: string }): Promise<void[]>;
        readForgeLogo(context: C, id: string): Promise<string>;
        /**
         * Remove the resource from the disk. Both the resource metadata and the resource file will be removed. 
         */
        removeResource(context: C, resource: string | AnyResource): Promise<void>;

        /**
         * Same to `refreshResources` except this only scan one resource.
         */
        refreshResource(context: C, resource: string | AnyResource): Promise<void>;

        /**
         * Rename resource, this majorly affect resource pack's displayed file name.
         */
        renameResource(context: C, option: { resource: string | AnyResource, name: string }): Promise<void>;
        /**
         * Import the resource into the launcher. 
         */
        importResource(context: C, option: ImportOption): Promise<TaskHandle>;

        /**
         * Export the resources into target directory. This will simply copy the resource out.
         */
        exportResource(context: C, option: { resources: (string | AnyResource)[], targetDirectory: string }): Promise<void>;
    }
}
export interface ResourceModule extends Module<"resource", ResourceModule.State, ResourceModule.Getters, ResourceModule.Mutations, ResourceModule.Actions> { }

export interface Source {
    path: string;
    date: string;
    [key: string]: string | Record<string, string>;
}

export type ImportOption = {
    path: string;
    type?: string | 'forge' | 'liteloader' | 'curseforge-modpack' | 'save';
    metadata?: any;
    background?: boolean;
}

export interface Resource<T> {
    name: string;
    path: string;
    hash: string;
    ext: string;
    type: string;
    domain: string | 'mods' | 'resourcepacks' | 'modpacks' | 'saves';
    metadata: T;
    source: Source;
}

export type AnyResource = Resource<any>;
export type ForgeResource = Resource<Forge.MetaData[]> & { type: 'forge' };
export type LiteloaderResource = Resource<LiteLoader.MetaData> & { type: 'liteloader' };
export type ResourcePackResource = Resource<ResourcePack> & { type: 'resourcepack' };
export type CurseforgeModpackResource = Resource<any> & { type: 'curseforge-modpack' };
export type SaveResource = Resource<Pick<World, 'path' | 'level'>> & { type: 'save' };

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
            if (typeof qObject !== 'object') return undefined;
            if ('modid' in qObject && 'version' in qObject) {
                const { modid, version } = qObject;
                return Object.values(state.domains.mods)
                    .filter(m => m.type === 'forge')
                    // eslint-disable-next-line
                    .find(m => m.metadata instanceof Array ? (m.metadata.some(me => me.modid === modid && me.version === version)) : false);
            }
            if ('name' in qObject && 'version' in qObject) {
                const { name, version } = qObject;
                return Object.values(state.domains.mods)
                    .filter(m => m.type === 'forge')
                    // eslint-disable-next-line
                    .find(m => 'version' in m.metadata ? (m.metadata.name === name && m.metadata.version === version) : false);
            }
            if ('fileId' in qObject) {
                const id = qObject.fileId
                for (const domain of Object.values(state.domains)) {
                    const found = Object.values(domain)
                        .find(r => 'curseforge' in r.source
                            && typeof r.source.curseforge === 'object'
                            && r.source.curseforge.fileId === id.toString());
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
