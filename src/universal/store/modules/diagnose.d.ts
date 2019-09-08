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

declare const mod: DiagnoseModule;

export default mod;
