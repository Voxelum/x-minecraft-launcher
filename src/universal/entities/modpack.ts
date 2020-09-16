import { RuntimeVersions } from './instance.schema';

/**
 * Represent a common modpack in a zip file.
 */
export interface Modpack {
    root: string; 
    runtime: RuntimeVersions;
}
