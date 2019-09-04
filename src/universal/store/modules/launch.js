/**
 * @type {import('./launch').LauncherModule}
 */
const mod = {
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
