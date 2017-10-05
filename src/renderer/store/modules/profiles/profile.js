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
        language: (state, gets) => gets['minecraft/options'].lang,
    },
    mutations: {
        putAll(state, option) {
            Object.keys(option)
                .filter(key => state.hasOwnProperty(key))
                .forEach((key) => { state[key] = option[key] })
        },
    },
    actions: {},
}
