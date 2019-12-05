export interface Source {
    path: string;
    /**
     * The date of import
     */
    date: string;
    [key: string]: string | Record<string, string>;
}

export interface ResourceConfig<T> {
    /**
     * The name of the resource
     */
    name: string;
    /**
     * The resource file path
     */
    path: string;
    /**
     * The sha1 of the resource
     */
    hash: string;
    /**
     * The suggested ext of the resource
     */
    ext: string;
    /**
     * The resource type. Can be `forge`, `liteloader`, `resourcepack`, and etc.
     */
    type: string;
    /**
     * The domain of the resource. This decide where (which folder) the resource go 
     */
    domain: string | 'mods' | 'resourcepacks' | 'modpacks' | 'saves';
    /**
     * The resource specific metadata
     */
    metadata: T;
    /**
     * Where the resource imported from?
     */
    source: Source;
}
