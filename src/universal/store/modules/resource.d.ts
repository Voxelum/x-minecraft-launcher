import { Context, Module, TaskHandle } from "../store";
import { Forge, LiteLoader, ResourcePack, World } from "ts-minecraft";

export declare namespace ResourceModule {
    interface Source {
        path: string,
        date: string | number,
        [key: string]: string | Record<string, string>
    }

    type ImportOption = {
        path: string;
        type?: string | 'forge' | 'liteloader' | 'curseforge-modpack' | 'save';
        metadata?: any;
        background?: boolean;
    }

    interface Resource<T> {
        name: string,
        path: string,
        hash: string,
        ext: string,
        type: string,
        domain: string | 'mods' | 'resourcepacks' | 'modpacks' | 'saves',
        metadata: T,
        source: Source,
    }

    type AnyResource = Resource<any>;
    type ForgeResource = Resource<Forge.MetaData[]> & { type: 'forge' };
    type LiteloaderResource = Resource<LiteLoader.MetaData> & { type: 'liteloader' };
    type ResourcePackResource = Resource<ResourcePack> & { type: 'resourcepack' };
    type CurseforgeModpackResource = Resource<any> & { type: 'curseforge-modpack' };
    type SaveResource = Resource<Pick<World, 'path' | 'level'>> & { type: 'save' };

    interface State {
        refreshing: boolean;
        mods: { [hash: string]: ForgeResource | LiteloaderResource };
        resourcepacks: { [hash: string]: ResourcePackResource };
        saves: { [hash: string]: SaveResource };
        modpacks: { [hash: string]: CurseforgeModpackResource };
    }
    interface Getters {
        domains: string[];
        mods: (ResourceModule.ForgeResource | ResourceModule.LiteloaderResource)[];
        resourcepacks: ResourceModule.ResourcePackResource[];
        saves: ResourceModule.SaveResource[];
        modpacks: ResourceModule.CurseforgeModpackResource[];

        getResource(hash: string): AnyResource | undefined;
    }

    interface Mutations {
        resource(state: State, resource: ResourceModule.AnyResource): void;
        resources(state: State, resources: ResourceModule.AnyResource[]): void;
        refreshingResource(state: State, refresh: boolean): void;
        removeResource(state: State, resource: ResourceModule.AnyResource): void;
    }
    type C = Context<State, Getters, Mutations, Actions>;

    interface Actions {
        refreshResources(context: C): Promise<void>;
        deployResources(context: C, payload: { resources: Resource<any>[], profile: string }): Promise<void>;
        readForgeLogo(context: C, id: string): Promise<string>;
        removeResource(context: C, resource: string | AnyResource): Promise<void>;

        refreshResource(context:C, resource: string | AnyResource): Promise<void>;

        importResource(context: C, option: ImportOption): Promise<TaskHandle>;
        exportResource(context: C, option: { resources: (string | AnyResource)[], targetDirectory: string }): Promise<void>;
    }
}
export interface ResourceModule extends Module<"resource", ResourceModule.State, ResourceModule.Getters, ResourceModule.Mutations, ResourceModule.Actions> { }

export type Resource<T> = ResourceModule.Resource<T>;
declare const mod: ResourceModule;

export default mod;
