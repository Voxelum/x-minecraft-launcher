import profile from './profile'

export default {
    namespaced: true,
    modules: { ...profile.modules },
    state: () => ({
        ...profile.state(),
        type: 'modpack',
        editable: true,
        author: '',
        description: '',
        url: '',
        icon: '',
    }),
    getters: {
        ...profile.getters,
    },
    mutations: {
        ...profile.mutations,
    },
    actions: {
        serialize(context, payload) {
            return JSON.stringify(context.state, (key, value) => {
                if (key === 'settings' || key === 'maps') return undefined;
                return value;
            })
        },
        refresh(context, payload) { },
    },
}
