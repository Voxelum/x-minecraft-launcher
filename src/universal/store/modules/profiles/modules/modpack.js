export default {
    namespaced: true,
    state: () => ({
        author: '',
        description: '',
        url: '',
        icon: '',
    }),
    mutations: {
        modpack(state, data) {
            state.author = data.author || state.author;
            state.description = data.description || state.description;
            state.url = data.url || state.url;
            state.icon = data.icon || state.icon;
        },
    },
    actions: {
        async load(context, { id }) {
            const data = await context.dispactch('read', { path: `profiles/${id}/pack-info.json`, fallback: {}, type: 'json' }, { root: true });
            context.commit('modpack', data);
        },
    },
}
