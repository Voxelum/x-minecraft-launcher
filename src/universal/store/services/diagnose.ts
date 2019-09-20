import { Module, Context } from "../store";
import { ResolvedLibrary, Version } from "@xmcl/version";
import { ForgeInstaller } from "@xmcl/minecraft-launcher-core";

export type Problem = DiagnoseModule.Problem;
export declare namespace DiagnoseModule {
    interface Problem {
        id: string;
        arguments?: { [key: string]: any };
        autofix?: boolean;
        optional?: boolean;
    }

    type ProblemReport = {
        [K in keyof State['registry']]: State['registry'][K]['actived']
    }

    interface Registry<A, AF = true, OP = false> {
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
            unknownMod: Registry<{ name: string; actual: string; }, false, true>;
            incompatibleMod: Registry<{ name: string; actual: string; accepted: string; }, false, true>;
            incompatibleResourcePack: Registry<{ name: string; actual: string; accepted: string; }, false, true>;
            incompatibleJava: Registry<{ java: string; mcversion: string }, false, false>;
            missingAuthlibInjector: Registry<{}>;
            missingModsOnServer: Registry<{ modid: string; version: string }, false, false>;
            badForge: Registry<{ forge: string; minecraft: string }>;
            badForgeIncomplete: Registry<{ count: number; libraries: Version.NormalLibrary[] }>;
            badForgeProcessedFiles: Registry<ForgeInstaller.Diagnosis["badProcessedFiles"][number], true, true>;


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
        postProblems(state: State, problems: Partial<ProblemReport>): void;
        startResolveProblems(state: State, problems: Problem[]): void;
        endResolveProblems(state: State, problems: Problem[]): void;
    }
    type C = Context<State, {}, Mutations, Actions>;
    interface Actions {
        diagnoseFull(context: C): Promise<void>;
        diagnoseVersion(context: C): Promise<void>;
        diagnoseMods(context: C): Promise<void>;
        diagnoseResourcePacks(context: C): Promise<void>;
        diagnoseJava(context: C): Promise<void>;
        diagnoseServer(context: C): Promise<void>;
        diagnoseUser(context: C): Promise<void>;

        fixProfile(context: C, problems: Problem[]): Promise<void>
    }
}
export interface DiagnoseModule extends Module<"diagnose", DiagnoseModule.State, DiagnoseModule.Getters, DiagnoseModule.Mutations, DiagnoseModule.Actions> { }

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
            /**
             * @type {import('./diagnose').DiagnoseModule.Problem[]}
             */
            const problems = [];

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
