import { Module, Context } from "..";

export type C = Context<State, {}>;
export interface Actions {
    launch(context: C, profileId?: string): Promise<boolean>;
}

type Status = 'ready' | 'checkingProblems' | 'launching' | 'launched' | 'minecraftReady' | 'error';
export interface State {
    status: Status;
    errorType: string;
    errors: any[];
}

export interface Mutations {
    launchStatus(state: State, status: Status): void;
    launchErrors(state: State, error: { type: string; content: any[] }): void;
}

export type LauncherModule = Module<"launch", State, {}, Mutations, Actions>;

const mod: LauncherModule = {
    state: {
        status: 'ready',
        errorType: '',
        errors: [],
    },
    mutations: {
        launchStatus(state, status) {
            state.status = status;
        },
        launchErrors(state, error) {
            state.errorType = error.type;
            state.errors = error.content;
        },
    },
};

export default mod;
