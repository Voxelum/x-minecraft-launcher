import { Fabric, Forge, LiteLoader } from '@xmcl/mod-parser';
import { readIcon, readPackMeta } from '@xmcl/resourcepack';
import { WorldReader } from '@xmcl/world';
import { ResourceRegistryEntry } from '.';

export const RESOURCE_ENTRY_FORGE: ResourceRegistryEntry<any> = ({
    type: 'forge',
    domain: 'mods',
    ext: '.jar',
    parseIcon: async (meta, fs) => {
        if (!meta || !meta.logoFile) { return undefined; }
        return fs.readFile(meta.logoFile);
    },
    parseMetadata: fs => Forge.readModMetaData(fs),
    getSuggestedName: (meta) => {
        let name = '';
        if (meta && meta.length > 0) {
            meta = meta[0];
            if (typeof meta.name === 'string' || typeof meta.modid === 'string') {
                name += (meta.name || meta.modid);
                if (typeof meta.mcversion === 'string') {
                    name += `-${meta.mcversion}`;
                }
                if (typeof meta.version === 'string') {
                    name += `-${meta.version}`;
                }
            }
        }
        return name;
    },
    getUri: meta => `forge://${meta[0].modid}/${meta[0].version}`,
});
export const RESOURCE_ENTRY_LITELOADER: ResourceRegistryEntry<any> = ({
    type: 'liteloader',
    domain: 'mods',
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
export const RESOURCE_ENTRY_FABRIC: ResourceRegistryEntry<any> = ({
    type: 'fabric',
    domain: 'mods',
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
export const RESOURCE_ENTRY_RESOURCE_PACK: ResourceRegistryEntry<any> = ({
    type: 'resourcepack',
    domain: 'resourcepacks',
    ext: '.zip',
    parseIcon: async (meta, fs) => readIcon(fs),
    parseMetadata: fs => readPackMeta(fs),
    getSuggestedName: () => '',
    getUri: (_, hash) => `resourcepack://${hash}`,
});
export const RESOURCE_ENTRY_SAVE: ResourceRegistryEntry<any> = ({
    type: 'save',
    domain: 'saves',
    ext: '.zip',
    parseIcon: async (meta, fs) => fs.readFile('icon.png'),
    parseMetadata: fs => new WorldReader(fs).getLevelData(),
    getSuggestedName: meta => meta.LevelName,
    getUri: (_, hash) => `save://${hash}`,
});
export const RESOURCE_ENTRY_MODPACK: ResourceRegistryEntry<any> = ({
    type: 'curseforge-modpack',
    domain: 'modpacks',
    ext: '.zip',
    parseIcon: () => Promise.resolve(undefined),
    parseMetadata: fs => fs.readFile('mainifest.json', 'utf-8').then(JSON.parse),
    getSuggestedName: () => '',
    getUri: (_, hash) => `modpack://${hash}`,
});
