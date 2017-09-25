import Vue from 'vue'

export default {
    namespaced: true,
    state: {
        mods: [],
        page: 1,
        pages: 1,
        version: '',
        versions: [],
        filter: '',
        filters: [],
        category: '',
        categories: [],
        loading: false,

        cached: {}, // cached project data
    },
    mutations: {
        update(state, { mods, page, pages, version, versions, filter, filters }) {
            state.mods = mods;
            state.page = page;
            state.pages = pages;
            state.versions = versions;
            state.filters = filters;
            state.version = version;
            state.filter = filter;
        },
        loading(state, loading) {
            state.loading = loading;
        },
        cache(state, { path, cache }) {
            Vue.set(state.cached, path, cache);
        },
        cacheDownload(state, { path, downloads, page }) {
            downloads.page = page;
            if (state.cached[path]) {
                if (Object.keys(state.cached[path].downloads).length === 0) {
                    state.cached[path].downloads = downloads;
                } else {
                    state.cached[path].downloads.page = downloads.page;
                    state.cached[path].downloads.pages = downloads.pages;
                    state.cached[path].downloads.files.push(...downloads.files);
                }
            }
        },
    },

    actions: {
        project({ dispatch, commit, state }, path) {
            if (path === undefined || path == null) return Promise.reject('Path cannot be null');
            if (!state.cached[path]) {
                return dispatch('query',
                    { service: 'curseforge', action: 'project', payload: `/projects/${path}` },
                    { root: true })
                    .then((proj) => { commit('cache', { path, cache: proj }) })
                    .then(() => dispatch('downloads', { path, page: 1 }))
                    .then(() => state.cached[path])
            }
            return Promise.resolve(state.cached[path])
        },
        downloads({ dispatch, commit, state }, { path, version, page }) {
            page = page || 1;
            return dispatch('query',
                { service: 'curseforge', action: 'downloads', payload: { path: `/projects/${path}`, version, page } },
                { root: true })
                .then((downloads) => {
                    commit('cacheDownload', { path, downloads, page });
                })
        },
        update({ dispatch, commit, state }, { page, version, filter }) {
            filter = filter || state.filter;
            version = version || state.version;
            page = page || state.page;
            commit('loading', true)
            return dispatch('query', {
                service: 'curseforge',
                action: 'mods',
                payload: { page, version, sort: filter },
            }, { root: true })
                .then((s) => {
                    commit('update', {
                        mods: s.mods,
                        page,
                        pages: s.pages,
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
