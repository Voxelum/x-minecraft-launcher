import { ResolvedLibrary } from '@xmcl/core';
import { InstallProfile } from '@xmcl/installer/minecraft';
import { ModuleOption } from '../root';
import { LocalVersion } from './version';

export interface Issue {
    id: string;
    arguments: { [key: string]: any };
    autofix?: boolean;
    optional?: boolean;
    multi: boolean;
}

export type IssueReport = {
    [K in keyof State['registry']]: State['registry'][K]['actived']
}

export type IssueType = keyof State['registry'];

export interface Registry<A, AF = true, OP = false> {
    fixing: boolean;
    autofix: AF;
    optional: OP;
    actived: (A & { file?: string; actual?: string; expect?: string })[];
}

interface State {
    registry: {
        missingVersion: Registry<{}>;
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

        missingAuthlibInjector: Registry<{}>;
        missingModsOnServer: Registry<{ modid: string; version: string }, false, false>;

        missingForge: Registry<{ forge: string; minecraft: string }>;
        missingFabric: Registry<{ fabric: string; minecraft: string }>;
        missingLiteloader: Registry<{ liteloader: string; minecraft: string }>;

        requireForge: Registry<{}, false, true>;
        requireFabric: Registry<{}, false, true>;

        badInstall: Registry<{ minecraft: string; version: string; installProfile: InstallProfile }>;

        [id: string]: {
            fixing: boolean;
            autofix: boolean;
            optional: boolean;
            actived: { [key: string]: any }[];
        };
    };
}

interface Getters {
    /**
     * The problems of current launcher state
     */
    issues: Issue[];
    isIssueActive: (id: keyof State['registry']) => boolean;
}

interface Mutations {
    issuesPost: Partial<IssueReport>;
    issuesStartResolve: Issue[];
    issuesEndResolve: Issue[];
}

export type DiagnoseModule = ModuleOption<State, Getters, Mutations, {}>;

const mod: DiagnoseModule = {
    state: {
        registry: {
            missingVersion: { fixing: false, autofix: true, optional: false, actived: [] },
            missingVersionJar: { fixing: false, autofix: true, optional: false, actived: [] },
            missingAssetsIndex: { fixing: false, autofix: true, optional: false, actived: [] },
            missingVersionJson: { fixing: false, autofix: true, optional: false, actived: [] },
            missingLibraries: { fixing: false, autofix: true, optional: false, actived: [] },
            missingAssets: { fixing: false, autofix: true, optional: false, actived: [] },

            corruptedVersionJar: { fixing: false, autofix: true, optional: true, actived: [] },
            corruptedAssetsIndex: { fixing: false, autofix: true, optional: true, actived: [] },
            corruptedVersionJson: { fixing: false, autofix: true, optional: true, actived: [] },
            corruptedLibraries: { fixing: false, autofix: true, optional: true, actived: [] },
            corruptedAssets: { fixing: false, autofix: true, optional: true, actived: [] },

            invalidJava: { fixing: false, autofix: true, optional: false, actived: [] },
            missingJava: { fixing: false, autofix: true, optional: false, actived: [] },

            missingFabric: { fixing: false, autofix: true, optional: false, actived: [] },

            missingForge: { fixing: false, autofix: true, optional: false, actived: [] },
            missingLiteloader: { fixing: false, autofix: true, optional: false, actived: [] },
            unknownMod: { fixing: false, autofix: false, optional: true, actived: [] },
            incompatibleMod: { fixing: false, autofix: false, optional: true, actived: [] },
            incompatibleResourcePack: { fixing: false, autofix: false, optional: true, actived: [] },
            missingAuthlibInjector: { fixing: false, autofix: true, optional: false, actived: [] },
            incompatibleJava: { fixing: false, autofix: false, optional: true, actived: [] },
            missingModsOnServer: { fixing: false, autofix: false, optional: false, actived: [] },
            badInstall: { fixing: false, autofix: true, optional: false, actived: [] },

            requireFabric: { fixing: false, autofix: false, optional: true, actived: [] },
            requireForge: { fixing: false, autofix: false, optional: true, actived: [] },
        },
    },
    getters: {
        issues(state) {
            const issues: Issue[] = [];

            for (const [id, reg] of Object.entries(state.registry)) {
                if (reg.actived.length === 0) continue;
                if (reg.actived.length >= 4) {
                    issues.push({
                        id,
                        arguments: { count: reg.actived.length, values: reg.actived },
                        autofix: reg.autofix,
                        optional: reg.optional,
                        multi: true,
                    });
                } else {
                    issues.push(...reg.actived.map(a => ({
                        id,
                        arguments: a,
                        autofix: reg.autofix,
                        optional: reg.optional,
                        multi: false,
                    })));
                }
            }

            return issues;
        },
        isIssueActive: (state) => (key) => (key in state.registry ? state.registry[key].actived.length !== 0 : false),
    },
    mutations: {
        issuesPost(state, issues) {
            for (const [id, value] of Object.entries(issues)) {
                if (value instanceof Array) {
                    if (!state.registry[id]) {
                        throw new Error(`This should not happen! Missing problem registry ${id}.`);
                    } else {
                        state.registry[id].actived = Object.freeze(value) as any;
                    }
                }
            }
        },
        issuesStartResolve(state, issues) {
            issues.forEach((p) => {
                state.registry[p.id].fixing = true;
            });
        },
        issuesEndResolve(state, issues) {
            issues.forEach((p) => {
                state.registry[p.id].fixing = false;
            });
        },
    },
};

export default mod;
