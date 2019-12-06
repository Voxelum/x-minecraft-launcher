import { ForgeInstaller } from '@xmcl/minecraft-launcher-core';
import { ResolvedLibrary, Version } from '@xmcl/version';
import { ModuleOption } from '../root';

export interface Problem {
    id: string;
    arguments?: { [key: string]: any };
    autofix?: boolean;
    optional?: boolean;
}

export type ProblemReport = {
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
        missingVersionJar: Registry<{ version: string }>;
        missingAssetsIndex: Registry<{ version: string }>;
        missingVersionJson: Registry<{ version: string }>;
        missingForgeJar: Registry<{ minecraft: string; forge: string }>;
        missingLibraries: Registry<ResolvedLibrary>;
        missingAssets: Registry<{ count: number }>;
        unknownMod: Registry<{ name: string; actual: string }, false, true>;
        incompatibleMod: Registry<{ name: string; actual: string; accepted: string }, false, true>;
        incompatibleResourcePack: Registry<{ name: string; actual: string; accepted: string }, false, true>;
        incompatibleJava: Registry<{ java: string; mcversion: string }, false, false>;
        missingAuthlibInjector: Registry<{}>;
        missingModsOnServer: Registry<{ modid: string; version: string }, false, false>;
        badForge: Registry<{ forge: string; minecraft: string }>;
        badForgeIncomplete: Registry<{ count: number; libraries: Version.NormalLibrary[] }>;
        badForgeProcessedFiles: Registry<ForgeInstaller.Diagnosis['badProcessedFiles'][number], true, true>;

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
    problems: Problem[];
}

interface Mutations {
    postProblems: Partial<ProblemReport>;
    startResolveProblems: Problem[];
    endResolveProblems: Problem[];
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
            unknownMod: { fixing: false, autofix: false, optional: true, actived: [] },
            incompatibleMod: { fixing: false, autofix: false, optional: true, actived: [] },
            incompatibleResourcePack: { fixing: false, autofix: false, optional: true, actived: [] },
            missingAuthlibInjector: { fixing: false, autofix: true, optional: false, actived: [] },
            incompatibleJava: { fixing: false, autofix: false, optional: false, actived: [] },
            missingModsOnServer: { fixing: false, autofix: false, optional: false, actived: [] },
            badForge: { fixing: false, autofix: true, optional: false, actived: [] },
            badForgeIncomplete: { fixing: false, autofix: true, optional: false, actived: [] },
            badForgeProcessedFiles: { fixing: false, autofix: true, optional: true, actived: [] },
        },
    },
    getters: {
        problems(state) {
            const problems: Problem[] = [];

            for (const [id, reg] of Object.entries(state.registry)) {
                if (reg.actived.length === 0) continue;
                if (id === 'missingLibraries' && reg.actived.length >= 3) {
                    problems.push({
                        id,
                        arguments: { count: reg.actived.length, libraries: reg.actived },
                        autofix: reg.autofix,
                        optional: reg.optional,
                    });
                } else {
                    problems.push(...reg.actived.map(a => ({
                        id,
                        arguments: a,
                        autofix: reg.autofix,
                        optional: reg.optional,
                    })));
                }
            }

            return problems;
        },
    },
    mutations: {
        postProblems(state, problems) {
            for (const [id, value] of Object.entries(problems)) {
                if (value instanceof Array) {
                    if (!state.registry[id]) {
                        console.error(`This should not happen! Missing problem registry ${id}.`);
                    } else {
                        state.registry[id].actived = value;
                    }
                }
            }
        },
        startResolveProblems(state, problems) {
            problems.forEach((p) => {
                state.registry[p.id].fixing = true;
            });
        },
        endResolveProblems(state, problems) {
            problems.forEach((p) => {
                state.registry[p.id].fixing = false;
            });
        },
    },
};

export default mod;
