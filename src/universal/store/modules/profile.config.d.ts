export interface ProfileConfig {
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
     * The java object containing the java info
     * @default null
     */
    java: {
        /**
         * The real path of the java paath
         */
        path: string;
        /**
         * The actual version string of the java
         */
        version: string;
        /**
         * The major version of selected java. If the version cannot be found, matching the java by this
         */
        majorVersion: number;
    },

    /**
     * Either a modpack or server. The modpack is the common profile. It can export into a modpack 
     * @default "modpack"
     */
    type: 'modpack' | 'server';

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
     * The external resource deployment of this profiles, like mods or resource packs
     * @default {}
     */
    deployments: {
        mods: string[];
        [domain: string]: string[];
    };

    /**
     * The version requirement of the profile.
     * 
     * Containing the forge & liteloader & etc.
     * @default { "minecraft": "", "forge": "", "liteloader": "" }
     */
    version: {
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
        [id: string]: string;
    };

    resolution: { width: number, height: number, fullscreen: boolean };
    minMemory?: number;
    maxMemory?: number;

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
}

export interface ModpackProfileConfig extends ProfileConfig {
    type: 'server';
    host: string;
    port: number;
}

export interface ServerProfileConfig extends ProfileConfig {
    type: 'modpack';
    author: string;
    description: string;
}

export interface ProfilesConfig {
    selectedProfile: string;
}
