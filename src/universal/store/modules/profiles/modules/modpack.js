export default {
    namespaced: true,
    state: () => ({
        author: '',
        description: '',
        url: '',
        icon: '',
    }),
    mutations: {
        edit(state, data) {
            state.author = data.author || state.author;
            state.description = data.description || state.description;
            state.url = data.url || state.url;
            state.icon = data.icon || state.icon;
        },
    },
    actions: {
        async load(context, { id }) {
            const data = await context.dispatch('read', { path: `profiles/${id}/pack-info.json`, fallback: {}, type: 'json' }, { root: true });
            context.commit('modpack', data);
        },
        save(context, { mutation }) {
            const id = mutation.split('/')[1];
            const path = `profiles/${id}/pack-info.json`;
            return context.dispatch('write', { path, data: context.state, type: 'json' }, { root: true });
        },
    },
}
