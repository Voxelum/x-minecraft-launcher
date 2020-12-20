import type { ResolvedLibrary } from '@xmcl/core';
import type { InstallProfile } from '@xmcl/installer';
import { LocalVersion } from './version';

export interface Issue {
    id: string;
    arguments: { [key: string]: any };
    autofix?: boolean;
    optional?: boolean;
    multi: boolean;
}

export type IssueReport = {
    [K in keyof IssueRegistry]: IssueRegistry[K]['actived']
}

export type IssueType = keyof IssueRegistry;

export interface IssueRegistry {
    missingVersionJar: Registry<{ version: string } & LocalVersion>;
    missingVersionJson: Registry<{ version: string } & LocalVersion>;
    missingLibraries: Registry<ResolvedLibrary>;
    missingAssetsIndex: Registry<{ version: string }>;
    missingAssets: Registry<{ version: string; hash: string; name: string; size: number }>;

    corruptedVersionJar: Registry<{ version: string } & LocalVersion, true, true>;
    corruptedVersionJson: Registry<{ version: string } & LocalVersion, true, true>;
    corruptedLibraries: Registry<ResolvedLibrary, true, true>;
    corruptedAssetsIndex: Registry<{ version: string }, true, true>;
    corruptedAssets: Registry<{ version: string; hash: string; name: string; size: number }, true, true>;

    unknownMod: Registry<{ name: string; actual: string }, false, true>;
    incompatibleMod: Registry<{ name: string; actual: string; accepted: string }, false, true>;
    incompatibleResourcePack: Registry<{ name: string; actual: string; accepted: string }, false, true>;
    incompatibleJava: Registry<{ java: string; type: string; version: string }, false, true>;

    missingJava: Registry<{}>;
    invalidJava: Registry<{ java: string }>;

    missingAuthlibInjector: Registry<{}, true, true>;
    missingCustomSkinLoader: Registry<{ target: 'forge' | 'fabric'; skinService: string; noVersionSelected: boolean; missingJar: boolean }, true, true>;
    missingModsOnServer: Registry<{ modid: string; version: string }, false, false>;

    missingVersion: Registry<{ forge: string; minecraft: string; yarn: string; fabricLoader: string; version: string }>;

    requireForge: Registry<{}, false, true>;
    requireFabric: Registry<{}, false, true>;
    requireFabricAPI: Registry<{ version: string; name: string }, false, true>;

    badInstall: Registry<{ minecraft: string; version: string; installProfile: InstallProfile }>;

    [id: string]: {
        fixing: boolean;
        autofix: boolean;
        optional: boolean;
        actived: { [key: string]: any }[];
    };
}

export interface Registry<A, AF = true, OP = false> {
    fixing: boolean;
    autofix: AF;
    optional: OP;
    actived: (A & { file?: string; actual?: string; expect?: string })[];
}
