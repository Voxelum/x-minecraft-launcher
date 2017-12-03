import { WorldInfo } from 'ts-minecraft'
import paths from 'path'
import Vue from 'vue'

export default {
    state: () => ({
        maps: [],
    }),
    getters: {
        maps: state => state.maps,
    },
    mutations: {
        setMaps(state, maps) {
            state.maps = maps;
        },
        addMap(state, map) {
            state.maps.push(map)
        },
        removeMap(state, map) {
            Vue.delete(state.maps, state.maps.indexOf(map))
        },
    },
    actions: {
        async importMap(context, locations) {
            if (typeof locations === 'string') {
                locations = [locations];
            }
            if (!(locations instanceof Array)) {
                throw new Error(`Arugment has to be array! ${locations}`)
            }
            const $import = async (location) => {
                const id = context.getters.id;
                const valid = await WorldInfo.valid(location)
                if (!valid) throw new Error(`Invalid map ${location}`)

                let name = paths.basename(location)
                if (await context.dispatch('exist', name)) {
                    name = `-${name}`
                }
                await context.dispatch('import', {
                    file: location,
                    toFolder: `profiles/${id}/saves/`,
                    name,
                }, { root: true })
                const data = await context.dispatch('read', {
                    path: `profiles/${id}/saves/${name}/level.dat`,
                }, { root: true })
                const mapinf = WorldInfo.parse(data);
                mapinf.filename = name;
                context.commit('addMap', mapinf);
            }
            return Promise.all(locations.map($import))
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{file:string, map:string, zip:boolean}} payload
         */
        exportMap(context, payload) {
            const id = context.getters.id;
            const { map, zip, file } = payload;
            return context.dispatch('query', {
                service: 'maps',
                action: 'export',
                payload: {
                    map: paths.join(context.rootGetters.root, `profiles/${id}/saves/${map}`),
                    exportName: file,
                    zip,
                },
            }, { root: true })
        },
        deleteMap(context, map) {
            const filename = map.filename;
            return context.dispatch('delete', `profiles/${context.getters.id}/saves/${filename}`, { root: true })
                .then(() => {
                    context.commit('removeMap', map)
                })
        },
        async load(context, payload) {
            const { id } = payload;
            const readMap = async (file) => {
                const exist = await context.dispatch('exist', `profiles/${id}/saves/${file}/level.dat`, { root: true })
                if (!exist) return undefined;
                const levBuf = await context.dispatch('read', {
                    path: `profiles/${id}/saves/${file}/level.dat`,
                    fallback: undefined,
                }, { root: true });
                if (levBuf === undefined) return undefined;
                const imgBuf = await context.dispatch('read', {
                    path: `profiles/${id}/saves/${file}/icon.png`,
                    fallback: undefined,
                }, { root: true })
                const info = WorldInfo.parse(levBuf);
                if (imgBuf) info.icon = `data:image/png;base64, ${imgBuf.toString('base64')}`;
                info.filename = file;
                return info
            }
            let maps;
            try {
                const files = (await context.dispatch('readFolder', { path: `profiles/${id}/saves` }, { root: true }))
                maps = (await Promise.all(files.map(readMap))).filter(m => m !== undefined);
            } catch (e) {
                console.warn(e)
            }
            context.commit('setMaps', maps);
        },
    },
}
