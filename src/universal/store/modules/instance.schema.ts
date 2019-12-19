/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface InstanceSchema {
    /**
     * The unique id (uuid) of the profile. The profile data will be stored into profiles/${id}/profile.json according to this.
     * @required
     * @default ""
     */
    id: string;
    /**
     * The display name of the profile. It will also be the modpack display name
     * @default ""
     */
    name: string;

    /**
     * The author of this instance
     */
    author?: string;

    /**
     * The description of this instance
     */
    description?: string;

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
    runtime: {
        /**
         * @default ""
         */
        minecraft: string;
        /**
         * @default ""
         */
        forge: string;
        /**
         * @default ""
         */
        liteloader: string;
        /**
         * @default ""
         */
        fabric?: string;

        [id: string]: string | undefined;
    };

    /**
     * The recommended java version for this instance
    * @default "8"
    */
    java: string;

    resolution: { width: number; height: number; fullscreen: boolean } | undefined;
    minMemory: number | undefined;
    maxMemory: number | undefined;

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
     * @default null
     */
    image: string | null;
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
     */
    server?: {
        host: string;
        port?: number;
    };

    licence?: string;
}

export interface InstancesSchema {
    selectedInstance: string;
}

export interface DeployedInfo {
    /**
     * If this is deployed by link, it will be a file path to the source.
     */
    src?: string;
    /**
     * The id listed in instance deployment
     */
    url: string;
    /**
     * Deployed file relative path to the .minecraft folder
     */
    file: string;
    /**
     * The sha256 of the src
     */
    integrity: string;
    /**
     * The way to resolve it. If it's false, it doesn't resolved.
     */
    resolved: false | 'unpack' | 'link';
}

export interface InstanceLockSchema {
    /**
     * The used java path
     */
    java: string;
    /**
     * The resources already deployed
     */
    deployed: DeployedInfo[];
}

export interface Instance extends InstanceLockSchema {
    config: InstanceSchema;
}

export const InstanceSchema: object = require('./InstanceSchema.json');
export const InstancesSchema: object = require('./InstancesSchema.json');
export const InstanceLockSchema: object = require('./InstanceLockSchema.json');
