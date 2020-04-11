import { ModuleOption } from '../root';

export type LaunchStatus = 'ready' | 'checkingProblems' | 'launching' | 'launched' | 'minecraftReady';

interface State {
    status: LaunchStatus;
    errorType: string;
    errors: any[];
}
interface Mutations {
    launchStatus: LaunchStatus;
    launchErrors: { type: string; content: any[] };
}

export type LauncherModule = ModuleOption<State, {}, Mutations, {}>;

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
