import modules from './modules'

export default {
    modules,
    state: () => ({
        id: '',
        type: '',
        name: '',
        resolution: { width: 800, height: 400, fullscreen: false },
        java: '',
        minMemory: 1024,
        maxMemory: 2048,
        vmOptions: [],
        mcOptions: [],
        mcversion: '',
    }),
    getters: {
        id: state => state.id,
        type: state => state.type,
        errors(state) {
            const errors = []
            if (state.mcversion === '') errors.push('profile.noversion')
            if (state.java === '' || state.java === undefined || state.java === null) errors.push('profile.missingjava')
            return errors
        },
        name: state => state.name,
        mcversion: state => state.mcversion,
        java: state => state.java,
        maxMemory: state => state.maxMemory,
        minMemory: state => state.minMemory,
        vmOptions: state => state.vmOptions,
        mcOptions: state => state.mcOptions,
        resolution: state => state.resolution,
    },
    mutations: {
        profile(state, option) {
            Object.keys(option)
                .filter(key => key !== 'type')
                .forEach((key) => { state[key] = option[key] })
        },
    },
    actions: {
        edit(context, option) {
            const keys = Object.keys(option);
            if (keys.length === 0) return;
            let changed = false;
            for (const key of keys) {
                if (context.state[key] !== undefined) {
                    if (context.state[key] !== option[key]) {
                        changed = true;
                    }
                }
            }
            if (changed) context.commit('profile', option)
        },
    },
}
