import type { FabricModMetadata, ForgeModMetadata as _ForgeModMetadata, LiteloaderModMetadata } from '@xmcl/mod-parser';
import type { PackMeta } from '@xmcl/resourcepack';
import type { LevelDataFrame } from '@xmcl/world';
import { CurseforgeModpackManifest } from './curseforge';
import { ForgeModCommonMetadata } from './mod';
import { Modpack } from './modpack';
import { ResourceDomain, ResourceSchema, ResourceType } from './resource.schema';

export interface Resource<T = unknown> extends Readonly<Omit<ResourceSchema, 'metadata' | 'version'>> {
    /**
     * The real path of the resource
     */
    readonly path: string;

    readonly metadata: T;
    /**
     * The ino of the file on disk
     */
    readonly ino: number;
    /**
     * The size of the resource
     */
    readonly size: number;
    /**
     * The suggested ext of the resource
     */
    readonly ext: string;
}

export type ForgeResource = Resource<ForgeModCommonMetadata> & { readonly type: ResourceType.Forge };
export type FabricResource = Resource<FabricModMetadata> & { readonly type: ResourceType.Fabric };
export type LiteloaderResource = Resource<LiteloaderModMetadata> & { readonly type: ResourceType.Liteloader };
export type ResourcePackResource = Resource<PackMeta.Pack> & { readonly type: ResourceType.ResourcePack };
export type CurseforgeModpackResource = Resource<CurseforgeModpackManifest> & { readonly type: ResourceType.CurseforgeModpack };
export type ModpackResource = Resource<Modpack> & { readonly type: ResourceType.Modpack };
export type SaveResource = Resource<LevelDataFrame> & { readonly type: ResourceType.Save };
export type UnknownResource = Resource<unknown> & { readonly type: ResourceType.Unknown };
export type ModResource = ForgeResource | FabricResource | LiteloaderResource;
export type Resources = ForgeResource
    | FabricResource
    | LiteloaderResource
    | CurseforgeModpackResource
    | ModpackResource
    | ResourcePackResource
    | SaveResource
    | UnknownResource;

export function isForgeResource(resource: Resource): resource is ForgeResource {
    return resource.type === 'forge';
}

export function isFabricResource(resource: Resource): resource is FabricResource {
    return resource.type === 'fabric';
}

export function isResourcePackResource(resource: Resource): resource is ResourcePackResource {
    return resource.type === 'resourcepack';
}

export function isModResource(resource: Resource): resource is ModResource {
    return resource.type === 'forge' || resource.type === 'fabric' || resource.type === 'liteloader';
}

export const UNKNOWN_RESOURCE: UnknownResource = Object.freeze({
    location: '',
    metadata: {},
    type: ResourceType.Unknown,
    domain: ResourceDomain.Unknown,
    ino: 0,
    size: 0,
    hash: '',
    ext: '',
    path: '',
    tags: [],
    name: '',
    uri: [],
    date: new Date('2000').toJSON(),
});

export function getResourceIdentifier(modObject: Resources) {
    if (modObject.type === 'forge' && modObject.metadata instanceof Array) {
        const meta = modObject.metadata[0];
        if (meta.modid && meta.version) {
            return `forge://${meta.modid}/${meta.version}`;
        }
    }
    if (modObject.type === 'liteloader') {
        const meta = modObject.metadata;
        if (meta.name && meta.version) {
            return `liteloader://${meta.name}/${meta.version}`;
        }
    }
    if (typeof modObject.curseforge === 'object') {
        const { fileId, projectId } = modObject.curseforge;
        if (fileId && projectId) {
            return `curseforge://${projectId}/${fileId}`;
        }
        if (fileId) {
            return `curseforge://${fileId}`;
        }
    }
    return `resource://${modObject.hash}`;
}
