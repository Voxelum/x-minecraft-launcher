import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: {},
    actions: {
        /**
         * Fetch The curseforge mods page content
         * 
         * @param {ActionContext} context 
         * @param {{page:string, version:string, filter:string}} payload 
         * @returns {{mods:ProjectPreview[], pages:string, filters:string[], versions:string[]}}
         */
        mods(context, payload) {
            const { page, version, filter } = payload;
            return context.dispatch('query', {
                service: 'curseforge',
                action: 'mods',
                payload: { page, version, sort: filter },
            }, { root: true })
        },
        /**
         * Query the project detail from path.
         * 
         * @param {ActionContext} context 
         * @param {string} path 
         * @return {Project}
         */
        project(context, path) {
            return context.dispatch('query',
                { service: 'curseforge', action: 'project', payload: `/projects/${path}` },
                { root: true })
        },

        /**
         * Query the project downloadable files.
         * 
         * @param {ActionContext} context 
         * @param {{path:string, version:string, page:string}} payload 
         * @return {Downloads}
         */
        files(context, payload) {
            const { path, page, version } = payload;
            return context.dispatch('query',
                {
                    service: 'curseforge',
                    action: 'downloads',
                    payload: { path: `/projects/${path}`, version, page },
                },
                { root: true },
            )
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} url 
         * @return {string}
         */
        license(context, url) {
            return context.dispatch('query',
                {
                    service: 'curseforge',
                    action: 'license',
                    payload: url,
                },
                { root: true },
            )
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{project:Project, file:Download}} payload 
         */
        async download(context, payload) {
            const file = await context.dispatch('query', {
                service: 'download',
                action: 'download',
                payload: { url: `https://minecraft.curseforge.com${payload.file.href}` },
            }, { root: true })
            return context.dispatch('repository/import', {
                files: [file],
                signiture: {
                    source: 'curseforge',
                    date: Date.now(),
                    meta: payload.project,
                },
            }, { root: true })
        },
    },
}
