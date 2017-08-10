function state() {
    return {
        type: '',

        name: '', // specific info
        version: '',

        resolution: [800, 400], // client setting
        java: '',
        minMemory: 1024,
        maxMemory: 2048,
        vmOptions: [],
        mcOptions: [],
    }
}
const getters = {
    errors(states) {
        const errors = []
        if (states.version === '' || states.version === undefined || states.version === null) errors.push('profile.empty.version')
        if (states.java === '' || states.java === undefined || states.java === null) errors.push('profile.empty.java')
        return errors
    },
    mods: (states, gets) => (gets.forge ? gets.forge.mods : []),
    resourcepacks: (states, gets) => gets.options.resourcepacks,
    language: (states, gets) => gets.options.lang,
}
const mutations = {
    putAll(states, option) {
        for (const key in option) {
            if (option.hasOwnProperty(key) && states.hasOwnProperty(key)) {
                states[key] = option[key];
            }
        }
    },
    toggle(states, option) { /* dummy mutation */ },
}

const actions = {
    async save(context, { id }) {
        
        const profileJson = `profiles/${id}/profile.json`
        const data = await context.dispatch('serialize')
        const settings = {
            minecraft: data.minecraft,
            forge: data.forge,
            liteloader: data.liteloader,
            optifine: data.optifine,
        };
        data.minecraft = undefined;
        data.forge = undefined;
        data.liteloader = undefined;
        data.optifine = undefined;
        return context.dispatch('writeFile', { path: profileJson, data }, { root: true })
            .then(() => context.dispatch('saveOptions', { id, settings }))
            .then(() => context.dispatch('saveOptifine', { id, settings }))
            .then(() => context.dispatch('saveForge', { id, settings }))
    },
}

export default {
    state,
    getters,
    mutations,
    actions,
}
