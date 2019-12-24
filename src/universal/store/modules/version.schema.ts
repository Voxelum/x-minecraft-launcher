/* eslint-disable @typescript-eslint/no-var-requires */
import Schema from '../Schema';

interface MinecraftVersion {
    id: string;
    type: string;
    time: string;
    releaseTime: string;
    url: string;
}
interface ForgeDownload {
    md5: string;
    sha1: string;
    /**
     * The url path to concat with forge maven
     */
    path: string;
}
interface ForgeVersion {
    /**
     * The minecraft version
     */
    mcversion: string;
    /**
     * The forge version (without minecraft version)
     */
    version: string;
    date: string;
    installer: ForgeDownload;
    universal: ForgeDownload;
    /**
     * The changelog info
     */
    changelog?: ForgeDownload;
    mdk?: ForgeDownload;
    source?: ForgeDownload;
    launcher?: ForgeDownload;
    /**
     * The type of the forge release. The `common` means the normal release.
     */
    type: 'buggy' | 'recommended' | 'common' | 'latest';
}
interface LiteloaderVersionMeta {
    version: string;
    url: string;
    file: string;
    mcversion: string;
    type: 'RELEASE' | 'SNAPSHOT';
    md5: string;
    timestamp: string;
    libraries: Array<{
        name: string;
        url?: string;
    }>;
    tweakClass: string;
}

export interface VersionMinecraftSchema {
    /**
     * @default ""
     */
    timestamp: string;
    /**
     * @default { "snapshot": "", "release": "" }
     */
    latest: {
        /**
         * Snapshot version id of the Minecraft
         * @default ""
         */
        snapshot: string;
        /**
         * Release version id of the Minecraft, like 1.14.2
         * @default ""
         */
        release: string;
    };
    /**
     * All the vesrsion list
     * @default []
     */
    versions: MinecraftVersion[];
}
export interface VersionForgeSchema {
    /**
     * @default ""
     */
    timestamp: string;
    /**
     * @default []
     */
    versions: ForgeVersion[];
    /**
     * @default ""
     */
    mcversion: string;
}
export interface VersionLiteloaderSchema {
    /**
     * @default ""
     */
    timestamp: string;
    /**
     * @default {}
     */
    meta: {
        description: string;
        authors: string;
        url: string;
        updated: string;
        updatedTime: number;
    };
    /**
     * @default {}
     */
    versions: {
        [version: string]: {
            snapshot?: LiteloaderVersionMeta;
            release?: LiteloaderVersionMeta;
        };
    };
}

export const VersionMinecraftSchema: Schema<VersionMinecraftSchema> = require('./VersionMinecraftSchema.json');
export const VersionForgeSchema: Schema<VersionForgeSchema> = require('./VersionForgeSchema.json');
export const VersionLiteloaderSchema: Schema<VersionLiteloaderSchema> = require('./VersionLiteloaderSchema.json');
