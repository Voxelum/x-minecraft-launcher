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
    },
    actions: {
        load(context, payload) {
            return context.dispatch('readFile', { path: 'version.json', fallback: {}, encoding: 'json' }, { root: true })
        },
        save(context, payload) {
            return context.dispatch('writeFile', { path: 'version.json', data: JSON.stringify(context.state) }, { root: true })
        },
        refresh(context, payload) {
            return context.dispatch('query', { service: 'versions', action: 'refresh', payload: context.state.updateTime }, { root: true })
                .then(remoteVersionList =>
                    context.dispatch('readFolder', { path: 'versions' }, { root: true })
                        .then((files) => {
                            const versions = new Set(files)
                            for (const ver of remoteVersionList.list.versions) {
                                if (versions.has(ver.id)) ver.status = 'local'
                                else ver.status = 'remote'
                            }
                            context.commit('update', remoteVersionList)
                        }),
            )
        },
    },
}
