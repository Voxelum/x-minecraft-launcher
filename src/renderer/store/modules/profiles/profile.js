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
        versoin: state => state.minecraft.version,
        vmOptions: state => state.vmOptions,
        mcOptions: state => state.mcOptions,
        language: (state, gets) => gets['minecraft/options'].lang,
    },
    mutations: {
        edit(state, option) {
        },
        putAll(state, option) {
            Object.keys(option)
                .filter(key => key !== 'type')
                .forEach((key) => { state[key] = option[key] })
        },
    },
    actions: {},
}
