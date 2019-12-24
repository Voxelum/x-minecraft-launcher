import { ResolvedLibrary, Version } from '@xmcl/core';
import { Diagnosis } from '@xmcl/installer';
import { ModuleOption } from '../root';
import { LocalVersion } from './version';

export interface Issue {
    id: string;
    arguments?: { [key: string]: any };
    autofix?: boolean;
    optional?: boolean;
}

export type IssueReport = {
    [K in keyof State['registry']]: State['registry'][K]['actived']
}

export interface Registry<A, AF = true, OP = false> {
    fixing: boolean;
    autofix: AF;
    optional: OP;
    actived: A[];
}

interface State {
    registry: {
        missingVersion: Registry<{}>;
        missingVersionJar: Registry<{ version: string } & LocalVersion>;
        missingVersionJson: Registry<{ version: string } & LocalVersion>;
        missingForgeJar: Registry<{ minecraft: string; forge: string }>;
        missingLibraries: Registry<ResolvedLibrary>;
        missingAssetsIndex: Registry<{ version: string }>;
        missingAssets: Registry<{ version: string; count: number }>;

        corruptedVersionJar: Registry<{ version: string } & LocalVersion>;
        corruptedVersionJson: Registry<{ version: string } & LocalVersion>;
        corruptedForgeJar: Registry<{ minecraft: string; forge: string }>;
        corruptedLibraries: Registry<ResolvedLibrary>;
        corruptedAssetsIndex: Registry<{ version: string }>;
        corruptedAssets: Registry<{ version: string; count: number }>;

        unknownMod: Registry<{ name: string; actual: string }, false, true>;
        incompatibleMod: Registry<{ name: string; actual: string; accepted: string }, false, true>;
        incompatibleResourcePack: Registry<{ name: string; actual: string; accepted: string }, false, true>;
        incompatibleJava: Registry<{ java: string; mcversion: string }, false, true>;
        missingAuthlibInjector: Registry<{}>;
        missingModsOnServer: Registry<{ modid: string; version: string }, false, false>;
        badForge: Registry<{ forge: string; minecraft: string }>;
        badForgeIncomplete: Registry<{ count: number; libraries: Version.NormalLibrary[] }>;
        badForgeProcessedFiles: Registry<Diagnosis.ForgeReport['unprocessed'][number], true, true>;

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
            missingForgeJar: { fixing: false, autofix: true, optional: false, actived: [] },
            missingLibraries: { fixing: false, autofix: true, optional: false, actived: [] },
            missingAssets: { fixing: false, autofix: true, optional: false, actived: [] },

            corruptedVersionJar: { fixing: false, autofix: true, optional: false, actived: [] },
            corruptedAssetsIndex: { fixing: false, autofix: true, optional: false, actived: [] },
            corruptedVersionJson: { fixing: false, autofix: true, optional: false, actived: [] },
            corruptedForgeJar: { fixing: false, autofix: true, optional: false, actived: [] },
            corruptedLibraries: { fixing: false, autofix: true, optional: false, actived: [] },
            corruptedAssets: { fixing: false, autofix: true, optional: false, actived: [] },

            unknownMod: { fixing: false, autofix: false, optional: true, actived: [] },
            incompatibleMod: { fixing: false, autofix: false, optional: true, actived: [] },
            incompatibleResourcePack: { fixing: false, autofix: false, optional: true, actived: [] },
            missingAuthlibInjector: { fixing: false, autofix: true, optional: false, actived: [] },
            incompatibleJava: { fixing: false, autofix: false, optional: true, actived: [] },
            missingModsOnServer: { fixing: false, autofix: false, optional: false, actived: [] },
            badForge: { fixing: false, autofix: true, optional: false, actived: [] },
            badForgeIncomplete: { fixing: false, autofix: true, optional: false, actived: [] },
            badForgeProcessedFiles: { fixing: false, autofix: true, optional: true, actived: [] },
        },
    },
    getters: {
        issues(state) {
            const issues: Issue[] = [];

            for (const [id, reg] of Object.entries(state.registry)) {
                if (reg.actived.length === 0) continue;
                if (id === 'missingLibraries' && reg.actived.length >= 3) {
                    issues.push({
                        id,
                        arguments: { count: reg.actived.length, libraries: reg.actived },
                        autofix: reg.autofix,
                        optional: reg.optional,
                    });
                } else {
                    issues.push(...reg.actived.map(a => ({
                        id,
                        arguments: a,
                        autofix: reg.autofix,
                        optional: reg.optional,
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
                        console.error(`This should not happen! Missing problem registry ${id}.`);
                    } else {
                        state.registry[id].actived = value;
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
