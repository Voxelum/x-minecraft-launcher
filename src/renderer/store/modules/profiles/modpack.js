import profile from './profile'

export default {
    namespaced: true,
    modules: { ...profile.modules },
    /**
     * @return {Modpack}
     */
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
        author: state => state.author,
        description: state => state.description,
        icon: state => state.icon,
    },
    mutations: {
        ...profile.mutations,
    },
    actions: {
        ...profile.actions,
        serialize(context, payload) {
            return JSON.stringify(context.state, (key, value) => {
                if (key === 'settings' || key === 'maps') return undefined;
                return value;
            })
        },
        refresh(context, payload) { },
    },
}
