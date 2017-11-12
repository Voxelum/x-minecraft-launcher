import settings from './settings'

export default {
    modules: { ...settings },
    state: () => ({
        type: '',
        name: '',
        resolution: { width: 800, height: 400, fullscreen: false },
        java: '',
        minMemory: 1024,
        maxMemory: 2048,
        vmOptions: [],
        mcOptions: [],
    }),
    getters: {
        errors(state) {
            const errors = []
            if (state.minecraft.version === '' || state.minecraft.version === undefined || state.minecraft.version === null) errors.push('profile.noversion')
            if (state.java === '' || state.java === undefined || state.java === null) errors.push('profile.missingjava')
            return errors
        },
        java: state => state.java,
        versoin: state => state.minecraft.version,
        vmOptions: state => state.vmOptions,
        mcOptions: state => state.mcOptions,
        language: (state, gets) => gets['minecraft/options'].lang,
    },
    mutations: {
        putAll(state, option) {
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
                if (context.state[key]) {
                    if (context.state[key] !== option[key]) {
                        changed = true;
                    }
                }
            }
            if (changed) context.commit('putAll', option)
        },
    },
}
