
export type ProjectType = 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks';

/**
 * The modpack metadata structure
 */
export interface CurseforgeModpackManifest {
    manifestType: string;
    manifestVersion: number;
    minecraft: {
        version: string;
        libraries?: string;
        modLoaders: {
            id: string;
            primary: boolean;
        }[];
    };
    name: string;
    version: string;
    author: string;
    files: {
        projectID: number;
        fileID: number;
        required: boolean;
    }[];
    overrides: string;
}
