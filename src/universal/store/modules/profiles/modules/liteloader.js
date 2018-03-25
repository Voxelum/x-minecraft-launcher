import { LiteLoader } from 'ts-minecraft'

export default {
    namespaced: true,
    state: () => ({
        version: '',
        settings: {},
    }),
    getters: {
        version: state => state.version,
        versionsByMc: state => version => [],
        recommendedByMc: state => version => [],
        latestByMc: state => version => [],
    },
    mutations: {
        setVersion(state, version) { state.version = version },
    },
    actions: {
        load() {

        },
        save() {

        },
        setVersion(context, version) {
            if (context.state.version !== version) context.commit('setVersion', version);
        },
    },
}
