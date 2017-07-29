function checkversion(remoteVersionList, files) {
    const versions = new Set(files)
    for (const ver of remoteVersionList.list.versions) {
        if (versions.has(ver.id)) ver.status = 'local'
        else ver.status = 'remote'
    }
}

export default {
    namespaced: true,
    state() {
        return {
            minecraft: {
                updateTime: '',
                versions: [],
                latest: {
                    snapshot: '',
                    release: '',
                },
            },
            forge: {
                updateTime: '',
                versions: {},
                latestsToIds: {},
            },
            liteloader: {
                updateTime: '',
                versions: [],
                metas: {},
            },
        }
    },
    getters: {
        forge: (state, getters) => { // return all the forge meta by mcversion
            console.log(getters)
        },
        liteloader: (state, getters) => { // return all the liteloader meta by mcversion

        },
    },
    mutations: {
        update(state, list) {
            state.updateTime = list.date;
            if (list.list) {
                state.minecraft.versions = list.list.versions;
                state.minecraft.latest.release = list.list.latest.release;
                state.minecraft.latest.snapshot = list.list.latest.snapshot;
            }
        },
        updateStatus(state, { version, status }) {
            version.status = status
        },
    },
    actions: {
        load(context, payload) {
            return context.dispatch('readFile', { path: 'version.json', fallback: {}, encoding: 'json' }, { root: true })
        },
        save(context, payload) {
            const data = JSON.stringify(context.state);
            return context.dispatch('writeFile', { path: 'version.json', data }, { root: true })
        },
        download(context, payload) {
            // TODO maybe validate paylaod
            console.log(context.rootState.settings.rootPath)
            const versionMeta = payload;
            const id = versionMeta.id;
            context.commit('updateStatus', { version: versionMeta, status: 'loading' })
            return context.dispatch('existFiles', { paths: [`versions/${id}`, `versions/${id}/${id}.jar`, `versions/${id}/${id}.jjson`] }, { root: true })
                .then(exist => (!exist ? context.dispatch('query', {
                    service: 'versions',
                    action: 'downloadClient',
                    payload: {
                        meta: payload,
                        location: context.rootGetters.rootPath,
                    },
                }, { root: true }) : undefined))
                .then(() => {
                    context.commit('updateStatus', { version: versionMeta, status: 'local' })
                }, (err) => {
                    console.error(err)
                    context.commit('updateStatus', { version: versionMeta, status: 'remote' })
                })
        },
        refresh(context, payload) {
            return context.dispatch('query', { service: 'versions', action: 'refresh', payload: context.state.updateTime }, { root: true })
                .then(remoteVersionList =>
                    context.dispatch('readFolder', { path: 'versions' }, { root: true })
                        .then((files) => {
                            checkversion(remoteVersionList, files)
                            context.commit('update', remoteVersionList)
                        }),
                (err) => {
                    // network error
                    throw err
                },
            )
        },
    },
}
