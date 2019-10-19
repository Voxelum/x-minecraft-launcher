import { ModuleOption } from "../root";

type Status = 'ready' | 'checkingProblems' | 'launching' | 'launched' | 'minecraftReady' | 'error';

interface State {
    status: Status;
    errorType: string;
    errors: any[];
}
interface Mutations {
    launchStatus: Status;
    launchErrors: { type: string; content: any[] };
}
interface Actions {
    launch: (profileId?: string) => boolean;
}

export type LauncherModule = ModuleOption<State, {}, Mutations, Actions>;

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
