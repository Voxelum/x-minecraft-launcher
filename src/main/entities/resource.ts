import { ImportTypeHint } from '@main/service/ResourceService';
import { linkOrCopy } from '@main/util/fs';
import { CurseforgeModpackManifest } from '@universal/entities/curseforge';
import { RuntimeVersions } from '@universal/entities/instance.schema';
import { Resource, Resources } from '@universal/entities/resource';
import { CurseforgeInformation, GithubInformation, ResourceDomain, ResourceSchema, ResourceType } from '@universal/entities/resource.schema';
import { resolveRuntimeVersion } from '@universal/entities/version';
import { Version } from '@xmcl/core';
import { Fabric, Forge, LiteLoader } from '@xmcl/mod-parser';
import { deserialize } from '@xmcl/nbt';
import { PackMeta, readIcon, readPackMeta } from '@xmcl/resourcepack';
import { FileSystem, openFileSystem } from '@xmcl/system';
import { LevelDataFrame } from '@xmcl/world';
import filenamify from 'filenamify';
import { ensureFile, stat, unlink, writeFile } from 'fs-extra';
import { basename, extname, join } from 'path';
import { findLevelRoot } from './save';

export type SourceInformation = {
    github?: GithubInformation;
    curseforge?: CurseforgeInformation;
};

export interface ResourceHeader {
    metadata: unknown;
    icon?: Uint8Array;
    domain: ResourceDomain;
    type: ResourceType;
    suggestedName: string;
    uri: string;
}
export interface ResourceParser<T> {
    type: ResourceType;
    domain: ResourceDomain;
    ext: string;
    parseIcon: (metadata: T, data: FileSystem) => Promise<Uint8Array | undefined>;
    parseMetadata: (data: FileSystem) => Promise<T>;
    getSuggestedName: (metadata: T) => string;
    /**
     * Get ideal uri for this resource
     */
    getUri: (metadata: T, hash: string) => string;
}


export interface ResourceBuilder extends Omit<ResourceSchema, 'metadata'> {
    icon?: Uint8Array;
    path: string;

    metadata: unknown;
    /**
     * The ino of the file on disk
     */
    ino: number;
    /**
     * The size of the resource
     */
    size: number;
    /**
     * The suggested ext of the resource
     */
    ext: string;
}

// resource entries

export const UNKNOWN_ENTRY: ResourceParser<unknown> = {
    type: ResourceType.Unknown,
    domain: ResourceDomain.Unknown,
    ext: '*',
    parseIcon: () => Promise.resolve(undefined),
    parseMetadata: () => Promise.resolve({}),
    getSuggestedName: () => '',
    getUri: () => '',
};
export const RESOURCE_PARSER_FORGE: ResourceParser<Forge.ModMetaData[]> = ({
    type: ResourceType.Forge,
    domain: ResourceDomain.Mods,
    ext: '.jar',
    parseIcon: async (meta, fs) => {
        if (!meta[0] || !meta[0].logoFile) { return undefined; }
        return fs.readFile(meta[0].logoFile);
    },
    parseMetadata: fs => Forge.readModMetaData(fs),
    getSuggestedName: (meta) => {
        let name = '';
        if (meta && meta.length > 0) {
            let metadata = meta[0];
            if (typeof metadata.name === 'string' || typeof metadata.modid === 'string') {
                name += (metadata.name || metadata.modid);
                if (typeof metadata.mcversion === 'string') {
                    name += `-${metadata.mcversion}`;
                }
                if (typeof metadata.version === 'string') {
                    name += `-${metadata.version}`;
                }
            }
        }
        return name;
    },
    getUri: meta => (meta[0] ? `forge://${meta[0].modid}/${meta[0].version}` : ''),
});
export const RESOURCE_PARSER_LITELOADER: ResourceParser<LiteLoader.MetaData> = ({
    type: ResourceType.Liteloader,
    domain: ResourceDomain.Mods,
    ext: '.litemod',
    parseIcon: async () => undefined,
    parseMetadata: fs => LiteLoader.readModMetaData(fs),
    getSuggestedName: (meta) => {
        let name = '';
        if (typeof meta.name === 'string') {
            name += meta.name;
        }
        if (typeof meta.mcversion === 'string') {
            name += `-${meta.mcversion}`;
        }
        if (typeof meta.version === 'string') {
            name += `-${meta.version}`;
        }
        if (typeof meta.revision === 'string' || typeof meta.revision === 'number') {
            name += `-${meta.revision}`;
        }
        return name;
    },
    getUri: meta => `liteloader://${meta.name}/${meta.version}`,
});
export const RESOURCE_PARSER_FABRIC: ResourceParser<Fabric.ModMetadata> = ({
    type: ResourceType.Fabric,
    domain: ResourceDomain.Mods,
    ext: '.jar',
    parseIcon: async (meta, fs) => {
        if (meta.icon) {
            return fs.readFile(meta.icon);
        }
        return Promise.resolve(undefined);
    },
    parseMetadata: async fs => Fabric.readModMetaData(fs),
    getSuggestedName: (meta) => {
        let name = '';
        if (typeof meta.name === 'string') {
            name += meta.name;
        } else if (typeof meta.id === 'string') {
            name += meta.id;
        }
        if (typeof meta.version === 'string') {
            name += `-${meta.version}`;
        } else {
            name += '-0.0.0';
        }
        return name;
    },
    getUri: meta => `fabric://${meta.id}/${meta.version}`,
});
export const RESOURCE_PARSER_RESOURCE_PACK: ResourceParser<PackMeta.Pack> = ({
    type: ResourceType.ResourcePack,
    domain: ResourceDomain.ResourcePacks,
    ext: '.zip',
    parseIcon: async (meta, fs) => readIcon(fs),
    parseMetadata: fs => readPackMeta(fs),
    getSuggestedName: () => '',
    getUri: (_, hash) => `resourcepack://${hash}`,
});
export const RESOURCE_PARSER_SAVE: ResourceParser<LevelDataFrame> = ({
    type: ResourceType.Save,
    domain: ResourceDomain.Saves,
    ext: '.zip',
    parseIcon: async (meta, fs) => fs.readFile('icon.png'),
    parseMetadata: async fs => {
        let root = await findLevelRoot(fs, '');
        if (!root) throw new Error();
        return deserialize(await fs.readFile(`${root}level.dat`));
    },
    getSuggestedName: meta => meta.LevelName,
    getUri: (_, hash) => `save://${hash}`,
});
export const RESOURCE_PARSER_MODPACK: ResourceParser<CurseforgeModpackManifest> = ({
    type: ResourceType.CurseforgeModpack,
    domain: ResourceDomain.Modpacks,
    ext: '.zip',
    parseIcon: () => Promise.resolve(undefined),
    parseMetadata: fs => fs.readFile('manifest.json', 'utf-8').then(JSON.parse),
    getSuggestedName: () => '',
    getUri: (_, hash) => `modpack://${hash}`,
});
export const RESOURCE_PARSER_COMMON_MODPACK: ResourceParser<{ root: string; runtime: RuntimeVersions }> = ({
    type: ResourceType.Modpack,
    domain: ResourceDomain.Modpacks,
    ext: '.zip',
    parseIcon: () => Promise.resolve(undefined),
    parseMetadata: async (fs) => {
        const findRoot = async () => {
            if (await fs.isDirectory('./versions')
                && await fs.isDirectory('./mods')) {
                return '';
            }
            if (await fs.isDirectory('.minecraft')) {
                return '.minecraft';
            }
            const files = await fs.listFiles('');
            for (const file of files) {
                if (await fs.isDirectory(file)) {
                    if (await fs.isDirectory(fs.join(file, 'versions'))
                        && await fs.isDirectory(fs.join(file, 'mods'))) {
                        return file;
                    }
                    if (await fs.isDirectory(fs.join(file, '.minecraft'))) {
                        return fs.join(file, '.minecraft');
                    }
                }
            }
            throw new Error();
        };
        const root = await findRoot();
        const versions = await fs.listFiles(fs.join(root, 'versions'));
        const runtime: RuntimeVersions = {
            minecraft: '',
            fabricLoader: '',
            forge: '',
            liteloader: '',
            yarn: '',
        };
        for (const version of versions) {
            const json = await fs.readFile(fs.join(fs.join(root, 'versions', version, `${version}.json`)), 'utf-8');
            const partialVersion = Version.normalizeVersionJson(json, '');

            resolveRuntimeVersion(partialVersion, runtime);
        }

        return { root, runtime };
    },
    getSuggestedName: () => '',
    getUri: (_, hash) => `modpack://${hash}`,
});
export const RESOURCE_PARSERS = [
    RESOURCE_PARSER_COMMON_MODPACK,
    RESOURCE_PARSER_FORGE,
    RESOURCE_PARSER_FABRIC,
    RESOURCE_PARSER_LITELOADER,
    RESOURCE_PARSER_RESOURCE_PACK,
    RESOURCE_PARSER_SAVE,
    RESOURCE_PARSER_MODPACK,
];

// resource functions

/**
 * Create a resource builder from source.
 */
export function createResourceBuilder(source: SourceInformation = {}): ResourceBuilder {
    return {
        name: '',
        location: '',
        path: '',
        hash: '',
        ext: '',
        domain: ResourceDomain.Unknown,
        type: ResourceType.Unknown,
        metadata: {},
        ino: 0,
        tags: [],
        size: 0,
        uri: [],
        date: new Date().toJSON(),
        ...source,
    };
}
export function getResourceFromBuilder(builder: ResourceBuilder): Resource {
    const res = { ...builder };
    delete res.icon;
    return Object.freeze(res);
}
export function getBuilderFromResource(resource: Resource): ResourceBuilder {
    return { ...resource };
}
export function mutateResource<T>(resource: Resource<T>, mutation: (builder: ResourceBuilder) => void): Resource<T> {
    const builder = getResourceFromBuilder(resource);
    mutation(builder);
    return getResourceFromBuilder(builder) as any;
}

export function getCurseforgeUrl(project: number, file: number): string {
    return `curseforge://id/${project}/${file}`;
}
export function getCurseforgeSourceInfo(project: number, file: number): SourceInformation {
    return {
        curseforge: {
            projectId: project,
            fileId: file,
        },
    };
}

export async function readResourceHeader(path: string, typeHint?: ImportTypeHint, parsers?: ResourceParser<any>[]): Promise<ResourceHeader> {
    parsers = parsers ?? RESOURCE_PARSERS;

    const ext = extname(path);
    const hint = typeHint || '';
    const chains: Array<ResourceParser<any>> = parsers
        .filter((hint === '*' || hint === '') ? (r => r.ext === ext) : (r => r.domain === hint || r.type === hint))
        .concat(UNKNOWN_ENTRY);

    let parser: ResourceParser<any> = UNKNOWN_ENTRY;
    let metadata: any;
    let icon: Uint8Array | undefined;
    let fs = await openFileSystem(path);

    for (const p of chains) {
        try {
            metadata = await p.parseMetadata(fs);
            icon = await p.parseIcon(metadata, fs).catch(() => undefined);
            parser = p;
            break;
        } catch (e) {
            // skip
        }
    }

    return {
        domain: parser.domain,
        type: parser.type,
        metadata,
        icon,
        suggestedName: parser.getSuggestedName(metadata) || basename(path, ext),
        uri: parser.getUri(metadata, ''),
    };
}

/**
 * Import
 * @param path The resource file path to import 
 * @param source The source
 * @param resolved 
 * @param root 
 */
export async function importResource(path: string, source: SourceInformation, resolved: ResourceHeader, root: string) {
    const { domain, type, metadata, icon, suggestedName, uri } = resolved;

    const builder = createResourceBuilder(source);
    builder.metadata = metadata;
    builder.domain = domain;
    builder.type = type;
    builder.icon = icon;
    builder.uri.push(uri);
    builder.ext = extname(path);

    const name = filenamify(suggestedName, { replacement: '-' });
    const slice = builder.hash.slice(0, 6);

    const location = join(builder.domain, `${name}.${slice}`);
    const filePath = join(root, `${location}${builder.ext}`);
    const metadataPath = join(root, `${location}.json`);
    const iconPath = join(root, `${location}.png`);

    await ensureFile(filePath);
    await linkOrCopy(path, filePath);
    await writeFile(metadataPath, JSON.stringify(getResourceFromBuilder(builder), null, 4));
    if (builder.icon) {
        await writeFile(iconPath, builder.icon);
    }

    const fileStatus = await stat(filePath);

    builder.location = location;
    builder.path = filePath;
    builder.ino = fileStatus.ino;

    return getResourceFromBuilder(builder);
}

export async function removeResource(resource: Readonly<Resource>, root: string) {
    let baseName = basename(resource.path, resource.ext);

    let filePath = resource.path;
    let metadataPath = join(root, resource.domain, `${baseName}.json`);
    let iconPath = join(root, resource.domain, `${baseName}.png`);

    await unlink(filePath);
    await unlink(metadataPath);
    await unlink(iconPath).catch(() => { });
}


// resource class

export class ResourceCache {
    private cache: Record<string, Resources> = {};

    put(resource: Resources) {
        this.cache[resource.hash] = resource;
        for (let url of resource.uri) {
            this.cache[url] = resource;
        }
        this.cache[resource.ino] = resource;
        this.cache[resource.path] = resource;
        if (resource.curseforge) {
            this.cache[getCurseforgeUrl(resource.curseforge.projectId, resource.curseforge.fileId)] = resource;
        }
    }

    discard(resource: Resource) {
        delete this.cache[resource.hash];
        for (let url of resource.uri) {
            delete this.cache[url];
        }
        delete this.cache[resource.ino];
        delete this.cache[resource.path];
    }

    get(key: string | number) {
        return this.cache[key];
    }
}
