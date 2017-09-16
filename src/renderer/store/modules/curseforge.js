
export default {
    namespaced: true,
    state: {
        mods: [],
        page: 1,
        pages: [],
        version: '',
        versions: [],
        filter: '',
        filters: [],
        loading: false,
    },
    mutations: {
        update(state, { mods, page, pages, version, versions, filter, filters }) {
            state.mods = mods;
            state.page = page;
            state.pages = pages
            state.versions = versions;
            state.filters = filters;
            state.version = version;
            state.filter = filter
        },
        loading(state, loading) {
            state.loading = loading
        },
    },

    actions: {
        update({ dispatch, commit, state }, { page, version, filter }) {
            filter = filter || state.filter;
            version = version || state.version;
            page = page || state.page;
            commit('loading', true)
            dispatch('query', {
                service: 'curseforge',
                action: 'mods',
                payload: { page, version, sort: filter },
            }, { root: true })
                .then((s) => {
                    const total = s.pages;
                    const start = Math.max(page - 2, 1)
                    const end = Math.min(page + 3, total);
                    const pages = []
                    if (start > 1) pages.push(1, '...');
                    for (let i = start; i < end; i += 1) pages.push(i);
                    if (end < total) pages.push('...', total)
                    commit('update', {
                        mods: s.mods,
                        page,
                        pages,
                        filter,
                        filters: s.filters,
                        version,
                        versions: s.versions,
                    })
                    commit('loading', false)
                })
        },
    },

}
