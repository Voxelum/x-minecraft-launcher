import { Context, Module, TaskHandle } from "../store";
import { Forge, LiteLoader, ResourcePack, World } from "@xmcl/minecraft-launcher-core";

export declare namespace ResourceModule {
    interface Source {
        path: string;
        date: string;
        [key: string]: string | Record<string, string>;
    }

    type ImportOption = {
        path: string;
        type?: string | 'forge' | 'liteloader' | 'curseforge-modpack' | 'save';
        metadata?: any;
        background?: boolean;
    }

    interface Resource<T> {
        name: string;
        path: string;
        hash: string;
        ext: string;
        type: string;
        domain: string | 'mods' | 'resourcepacks' | 'modpacks' | 'saves';
        metadata: T;
        source: Source;
    }

    type AnyResource = Resource<any>;
    type ForgeResource = Resource<Forge.MetaData[]> & { type: 'forge' };
    type LiteloaderResource = Resource<LiteLoader.MetaData> & { type: 'liteloader' };
    type ResourcePackResource = Resource<ResourcePack> & { type: 'resourcepack' };
    type CurseforgeModpackResource = Resource<any> & { type: 'curseforge-modpack' };
    type SaveResource = Resource<Pick<World, 'path' | 'level'>> & { type: 'save' };

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
        mods: (ResourceModule.ForgeResource | ResourceModule.LiteloaderResource)[];
        resourcepacks: ResourceModule.ResourcePackResource[];
        saves: ResourceModule.SaveResource[];
        modpacks: ResourceModule.CurseforgeModpackResource[];

        getResource(hash: string): AnyResource | undefined;

        queryResource(payload: string
            | { modid: string; version: string; }
            | { fileId: number; }
            | { fileId: number; projectId: number }
            | { name: string; version: string; }): AnyResource | undefined;
    }

    interface Mutations {
        resource(state: State, resource: ResourceModule.AnyResource): void;
        resources(state: State, resources: ResourceModule.AnyResource[]): void;
        refreshingResource(state: State, refresh: boolean): void;
        removeResource(state: State, resource: ResourceModule.AnyResource): void;
    }
    type C = Context<State, Getters, Mutations, Actions>;

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

export type Resource<T> = ResourceModule.Resource<T>;
declare const mod: ResourceModule;

export default mod;
