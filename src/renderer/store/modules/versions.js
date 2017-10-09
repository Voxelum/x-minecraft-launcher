import { VersionMeta } from 'ts-minecraft'

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
        versions: [],
        latest: {
            snapshot: '',
            release: '',
        },
    }),
    getters: {
        versions: state => state.versions,
        latestRelease: state => state.latest.release,
        latestSnapshot: state => state.latest.snapshot,
    },
    mutations: {
        update(state, list) {
            state.updateTime = list.date;
            if (list.list) {
                state.versions = list.list.versions;
                state.latest.release = list.list.latest.release;
                state.latest.snapshot = list.list.latest.snapshot;
            }
        },
        updateStatus(state, { version, status }) {
            version.status = status
        },
    },
    actions: {
        load(context, payload) {
            return context.dispatch('read', { path: 'version.json', fallback: {}, encoding: 'json' }, { root: true })
        },
        save(context, payload) {
            const data = JSON.stringify(context.state);
            return context.dispatch('write', { path: 'version.json', data }, { root: true })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {VersionMeta} meta
         */
        async download(context, meta) {
            const id = meta.id;
            context.commit('updateStatus', { version: meta, status: 'loading' })
            let exist = await context.dispatch('exist', { paths: [`versions/${id}`, `versions/${id}/${id}.jar`, `versions/${id}/${id}.json`] }, { root: true });
            if (!exist) {
                try {
                    await context.dispatch('query', {
                        service: 'versions',
                        action: 'downloadClient',
                        payload: {
                            meta,
                            location: context.rootGetters.root,
                        },
                    }, { root: true })
                } catch (e) { console.warn(e) }
            }
            exist = await context.dispatch('exist', { paths: [`versions/${id}`, `versions/${id}/${id}.jar`, `versions/${id}/${id}.json`] }, { root: true });
            if (exist) {
                context.commit('updateStatus', { version: meta, status: 'local' })
            } else {
                context.commit('updateStatus', { version: meta, status: 'remote' })
            }
        },
        /**
         * Refresh the remote versions cache 
         */
        async refresh(context) {
            const remoteList = await context.dispatch('query', { service: 'versions', action: 'refresh', payload: context.state.updateTime }, { root: true })
            const files = await context.dispatch('readFolder', { path: 'versions' }, { root: true })
            const existed = []
            for (const file of files) {
                const exist = await context.dispatch('exist', { paths: [`versions/${file}`, `versions/${file}/${file}.jar`, `versions/${file}/${file}.json`] }, { root: true }); // eslint-disable-line
                if (exist) existed.push(file)
            }
            checkversion(remoteList, existed)
            context.commit('update', remoteList)
        },
    },
}
