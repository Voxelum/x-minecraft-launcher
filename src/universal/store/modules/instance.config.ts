export interface InstanceConfig {
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
     * The external resource deployment of this profiles, like mods or resource packs
     * @default {}
     */
    deployments: {
        [domain: string]: { [key: string]: string };
    };

    /**
    * The optional external resource deployment of this profiles, like mods or resource packs
    * @default {}
    */
    optionalDeployments: {
        [domain: string]: { [key: string]: string };
    };

    /**
     * The runtime & version requirement of the profile.
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
        fabric: string;

        /**
         * @default "8"
         */
        java: string;
        [id: string]: string;
    };

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

export interface ProfilesConfig {
    selectedProfile: string;
}

export interface InstanceLockConfig {
    /**
     * The path of the java
     */
    java: string;
    /**
     * The resources already deployed
     */
    deployed: {
        [domain: string]: {
            [name: string]: {
                /**
                 * If this is deployed by link, it will be a file path to the source
                 */
                src?: string;
                /**
                 * Deployed file name
                 */
                file: string;
                /**
                 * The sha256 of it
                 */
                integrity: string;
            };
        };
    };
}

export interface Instance extends InstanceLockConfig {
    config: InstanceConfig;
}
