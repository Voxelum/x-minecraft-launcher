import { VersionMeta, MinecraftFolder, Version, LiteLoader, Forge } from 'ts-minecraft'

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
    modules: {
        forge: {
            namespaced: true,
            state: () => ({
                date: '',
                list: {
                    mcversion: {},
                    promos: {},
                },
            }),
            getters: {
                versions: state => state.list.number || [],
                versionsByMc: state =>
                    version =>
                        (state.list.mcversion[version] || [])
                            .map((num) => {
                                const meta = { ...state.list.number[num], status: 'remote' };
                                if (state.list.promos[`${version}-recommended`] === num) {
                                    meta.type = 'recommended';
                                } else if (state.list.promos[`${version}-latest`] === num) {
                                    meta.type = 'latest';
                                } else {
                                    meta.type = 'snapshot';
                                }
                                return meta;
                            }),
                latestByMc: state =>
                    version => state.list.number[state.list.promos[`${version}-latest`]],
                recommendedByMc: state =>
                    version => state.list.number[state.list.promos[`${version}-recommended`]],
            },
            mutations: {
                update(state, list) {
                    state.list = list.list;
                    state.date = list.date;
                },
            },
            actions: {
                async load(context, payload) {
                    const struct = await context.dispatch('read', { path: 'forge-versions.json', fallback: {}, type: 'json' }, { root: true });
                    context.commit('update', struct);
                    return context.dispatch('refresh').then(() => context.dispatch('save'));
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
                    const task = Forge.installTask(meta, context.rootGetters.root, true);
                    context.dispatch('task/listen', task);
                    return task.execute();
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
                    const remoteList = await Forge.VersionMetaList.update({
                        fallback: { date: context.state.date || '', list: context.state.list },
                    });
                    context.commit('update', remoteList);
                },
            },
        },
        liteloader: {
            namespaced: true,
            state: () => ({
                list: {
                    versions: {},
                },
                date: '',
            }),
            getters: {
                versions: state => state.list.versions || [],
                versionsByMc: state => // [],
                    version => state.list.versions[version] || [],
            },
            mutations: {
                update(state, content) {
                    state.list = content.list;
                    state.date = content.date;
                },
            },
            actions: {
                async load(context) {
                    const struct = await context.dispatch('read', { path: 'lite-versions.json', fallback: {}, type: 'json' }, { root: true });
                    context.commit('update', struct);
                    return context.dispatch('refresh').then(() => context.dispatch('save'));
                },
                save(context) {
                    const data = JSON.stringify(context.state);
                    return context.dispatch('write', { path: 'lite-versions.json', data }, { root: true })
                },
                download(context, meta) {
                    const task = LiteLoader.installTask(meta, context.rootGetters.root, true);
                    context.dispatch('task/listen', task);
                    return task.execute();
                },
                async refresh(context) {
                    const option = context.state.date === '' ? undefined : {
                        fallback: { date: context.state.date || '', list: context.state.list || [] },
                    };
                    const remoteList = await LiteLoader.VersionMetaList.update();
                    context.commit('update', remoteList);
                },
            },
        },
    },
    getters: {
        versions: state => state.versions || [],
        versionsMap: state => state.versions.reduce((o, v) => { o[v.id] = v; return o; }, {}) || {},
        latestRelease: state => state.latest.release || '',
        latestSnapshot: state => state.latest.snapshot || '',
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
        async load(context, payload) {
            const data = await context.dispatch('read', { path: 'version.json', fallback: {}, type: 'json' }, { root: true })
            const container = {
                date: data.updateTime,
                list: data,
            }
            let metas = container;
            try {
                metas = await Version.updateVersionMeta({ fallback: container })
                const files = await context.dispatch('readFolder', { path: 'versions' }, { root: true })
                const existed = []
                for (const file of files) {
                    const exist = await context.dispatch('exist', [`versions/${file}`, `versions/${file}/${file}.jar`, `versions/${file}/${file}.json`], { root: true }); // eslint-disable-line
                    if (exist) existed.push(file)
                }
                checkversion(metas, existed)
            } catch (e) {
                console.error(e)
            }
            context.commit('update', metas);
        },
        save(context, payload) {
            return context.dispatch('write', {
                path: 'version.json',
                data: JSON.stringify(context.state,
                    (key, val) => {
                        if (key === 'forge' || key === 'liteloader') return undefined;
                        return val;
                    }),
            }, { root: true })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {VersionMeta|string} meta
         */
        async download(context, meta) {
            if (typeof meta === 'string') {
                if (!context.getters.versionsMap[meta]) throw new Error(`Cannot find the version meta for [${meta}]. Please Refresh the meta cache!`)
                meta = context.getters.versionsMap[meta];
            }

            const id = meta.id;
            context.commit('updateStatus', { version: meta, status: 'loading' })
            let exist = await context.dispatch('exist', [`versions/${id}`, `versions/${id}/${id}.jar`, `versions/${id}/${id}.json`], { root: true });
            if (!exist) {
                try {
                    let location = context.rootGetters.root;
                    if (typeof location === 'string') location = new MinecraftFolder(location)
                    if (!(location instanceof MinecraftFolder)) return Promise.reject('Require location as string or MinecraftLocation!')
                    Version.install('client', meta, location);
                } catch (e) { console.warn(e) }
            }
            exist = await context.dispatch('exist', [`versions/${id}`, `versions/${id}/${id}.jar`, `versions/${id}/${id}.json`], { root: true });
            if (exist) {
                context.commit('updateStatus', { version: meta, status: 'local' })
            } else {
                context.commit('updateStatus', { version: meta, status: 'remote' })
            }
            return undefined;
        },
        checkClient(context, { version, location }) {
            if (typeof location === 'string') location = new MinecraftFolder(location)
            if (!(location instanceof MinecraftFolder)) return Promise.reject('Require location as string or MinecraftLocation!')
            return Version.checkDependency(version, location)
        },
        /**
         * Refresh the remote versions cache 
         */
        async refresh(context) {
            const remoteList = await Version.updateVersionMeta({ date: context.state.updateTime })
            const files = await context.dispatch('readFolder', { path: 'versions' }, { root: true })
            const existed = []
            for (const file of files) {
                const exist = await context.dispatch('exist', [`versions/${file}`, `versions/${file}/${file}.jar`, `versions/${file}/${file}.json`], { root: true }); // eslint-disable-line
                if (exist) existed.push(file)
            }
            checkversion(remoteList, existed)
            context.commit('update', remoteList)
        },
    },
}
