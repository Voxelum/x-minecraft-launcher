import { Forge } from 'ts-minecraft'

function checkversion(remoteVersionList, files) {
    const versions = new Set(files)
    for (const ver of remoteVersionList.list.versions) {
        if (versions.has(ver.id)) ver.status = 'local'
        else ver.status = 'remote'
    }
}

export default {
    namespaced: true,
    state: () => ({
        updateTime: '',
        versions: {
            mcversion: {},
            promos: {},
        },
    }),
    getters: {
        versions: state => state.versions,
        versionsByMc: state => version => state.versions.mcversion[version],
        latests: state => state.promos,
        latestByMc: state => version => state.versions.promos[`${version}-latest`],
        recommendedByMc: state => version => state.versions.promos[`${version}-recommended`],
    },
    mutations: {
        update(state, list) {
            state.versions = list.list;
            state.updateTime = list.date;
        },
        // updateStatus(state, { version, status }) {
        //     version.status = status
        // },
    },
    actions: {
        load(context, payload) {
            // ipcRenderer.on('refresh', () => {
                // context.dispatch('refresh');
            // })
            return context.dispatch('read', { path: 'forge-versions.json', fallback: {}, type: 'json' }, { root: true })
        },
        save(context, payload) {
            const data = JSON.stringify(context.state);
            return context.dispatch('write', { path: 'forge-versions.json', data }, { root: true })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {VersionMeta|string} meta
         */
        async download(context, meta) {
            console.log(meta)
            return context.dispatch('query', {
                service: 'versions',
                action: 'downloadForge',
                payload: { meta, minecraft: context.rootGetters.root },
            }, { root: true })
        },
        async checkLocalForge(context, forgeMeta) {
            const files = await context.dispatch('readFolder', { path: 'versions' }, { root: true })
            const forgeFolder = `${forgeMeta.mcversion}-forge-${forgeMeta.version}`;
            const idx = files.indexOf(forgeFolder)
            if (!idx) return false;
            return await context.dispatch('exist', [`versions/${forgeFolder}/${forgeFolder}.jar`, `versions/${forgeFolder}/${forgeFolder}.json`], { root: true }); // eslint-disable-line
        },
        /**
        * Refresh the remote versions cache 
        */
        async refresh(context) {
            const remoteList = await context.dispatch('query', { service: 'versions', action: 'refreshForge' }, { root: true })
            context.commit('update', remoteList)
        },
    },
}
