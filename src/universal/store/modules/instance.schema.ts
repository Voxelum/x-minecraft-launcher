import Schema from '../Schema';

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface RuntimeVersions {
    /**
     * Minecraft version of this version. e.g. 1.7.10
     * @default ""
     */
    minecraft: string;
    /**
     * Forge version of this version. e.g. 14.23.5.2838
     * @default ""
     */
    forge: string;
    /**
     * @default ""
     */
    liteloader: string;
    /**
     * Fabric loader version, e.g. 0.7.2+build.175
     * @default ""
     */
    fabricLoader: string;
    /**
     * Fabric yarn version, e.g. 1.15.1+build.14
     */
    yarn: string;

    [id: string]: string | undefined;
}

export interface InstanceSchema {
    /**
     * The display name of the profile. It will also be the modpack display name
     * @default ""
     */
    name: string;

    /**
     * The author of this instance
     * @default ""
     */
    author: string;

    /**
     * The description of this instance
     * @default ""
     */
    description: string;

    /**
     * Should show a logger window after Minecraft launched
     * @default false
     */
    showLog: boolean;
    /**
     * Should launcher hide after Minecraft launched
     * @default true
     */
    hideLauncher: boolean;

    /**
     * The external resource deployment of this instance, like mods or resource packs.
     * 
     * The domain is the directory it will deployed to. For example, `mods` will deploy to `.minecraft/mods` folder.
     * 
     * Each is a list of uri in specific format
     * 
     * - Curseforge file `curseforge://projectId/fileId` or `curseforge://fileId`
     * - Forge mod: `forge://modid/version`
     * - Liteloader mod: `liteloader://name/version`
     * - Fabric mod: `fabric://name/version`
     * - Local managed resource: `resource://hash`
     * - Http: `https://abc.bcd.jar`
     * - Github: `github://username/reponame/releaseName`
     * 
     * @default {}
     */
    deployments: {
        [domain: string]: string[];
    };

    /**
    * The optional external resource deployment of this profiles, like mods or resource packs
    * @default []
    */
    optionalDeployments: string[];

    /**
     * The runtime version requirement of the profile.
     * 
     * Containing the forge & liteloader & etc.
     * @default { "minecraft": "", "forge": "", "liteloader": "" }
     */
    runtime: RuntimeVersions;

    /**
     * The recommended java version for this instance
    * @default "8"
    */
    java: string;

    resolution: { width: number; height: number; fullscreen: boolean } | null;
    /**
     * @default 0
     */
    minMemory: number;
    /**
     * @default 0
     */
    maxMemory: number;
    /**
     * @default []
     */
    vmOptions: string[];
    /**
     * @default []
     */
    mcOptions: string[];

    /**
     * @default ""
     */
    url: string;
    /**
     * @default ""
     */
    icon: string;

    /**
     * @default ""
     */
    image: string;
    /**
     * @default 0
     */
    blur: number;

    /**
     * @default 0
     */
    lastAccessDate: number;
    /**
     * @default 0
     */
    creationDate: number;
    /**
     * The option for instance to launch server directly
     * @default null
     */
    server: {
        host: string;
        port?: number;
    } | null;
}

export interface InstancesSchema {
    selectedInstance: string;
    /**
     * The extra imported instance path
     * @default []
     */
    instances: string[];
}

export interface DeployedInfo {
    /**
     * If this is deployed by link, it will be a file path to the source.
     */
    src?: string;
    /**
     * Deployed file relative path to the .minecraft folder
     */
    file: string;
    url: string;
    /**
     * The way to resolve it. If it's false, it doesn't resolved.
     */
    resolved: false | 'unpack' | 'link';
}

export interface InstanceLockSchema {
    /**
     * The instance assigned java path on disk.
     * @default ""
     */
    java: string;
    /**
     * @default []
     * The resources already deployed
     */
    deployed: DeployedInfo[];
}

export interface Instance extends InstanceLockSchema {
    config: InstanceSchema;
}

export const InstanceSchema: Schema<InstanceSchema> = require('./InstanceSchema.json');
export const InstancesSchema: Schema<InstancesSchema> = require('./InstancesSchema.json');
export const InstanceLockSchema: Schema<InstanceLockSchema> = require('./InstanceLockSchema.json');
