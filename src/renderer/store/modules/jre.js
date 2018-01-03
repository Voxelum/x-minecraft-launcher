import Vue from 'vue'

export default {
    namespaced: true,
    state: {
        users: {},
        detected: {},
        failed: {},
        default: {
            path: '',
            from: '',
        },
    },
    getters: {
        availables: (state) => {
            const out = Object.assign({}, state.users, state.detected);
            for (const k in state.failed) {
                if (out[k]) delete out[k];
            }
            return out;
        },
        default: (state, getters) => {
            if (state[state.default.from] && state[state.default.from][state.default.path]) {
                return {
                    path: state.default.path,
                    description: state[state.default.from][state.default.path],
                }
            }
            return getters.availables.length === 0 ? '' : getters.availables[0];
        },
        has: state => java => state.users[java] !== undefined &&
            state.detected[java] !== undefined &&
            state.failed[java] !== undefined,
    },
    mutations: {
        add(state, java) {
            if (typeof java !== 'object') throw new Error('Require java as a object containing a path and a description');
            if (typeof java.path !== 'string') throw new Error('Require java path is a string');
            // if (typeof java.description !== 'string') throw new Error('Require description is a string');
            state.users[java.path] = java.description;
        },
        setDefault(state, jre) {
            if (typeof jre !== 'object') throw new Error('Require java as a object containing a path and a description');
            if (typeof jre.path !== 'string') throw new Error('Require java path is a string');
            if (typeof jre.from !== 'string') throw new Error('Require from is a string');
            if (!state[jre.from][jre.path]) throw new Error('Cannot find the default path!')
            state.default.path = jre.path;
        },
        remove(state, java) {

        },
        addToDetected(state, java) {
            if (typeof java !== 'object') throw new Error('Require java as a object containing a path and a description');
            if (typeof java.path !== 'string') throw new Error('Require java path is a string');
            // if (typeof java.description !== 'string') throw new Error('Require description is a string');
            state.detected[java.path] = java.description;
        },
        addToFailed(state, { path }) {
            if (typeof path !== 'string') throw new Error('Require java path is a string');
            state.failed[path] = 0;
        },
    },
    actions: {
        async load(context) {
            const data = await context.dispatch('read', {
                path: 'jre.json',
                fallback: {},
                type: 'json',
            }, { root: true })
            const all = await Promise.all(Object.keys(data).map(java =>
                context.dispatch('validate', java)))
            for (const result of all) {
                context.commit('add', result);
                if (!result.valid) context.commit('addToFailed', result);
            }
            return context.dispatch('refresh');
        },
        save(context) {
            const data = Object.assign(context.state.users)
            return context.dispatch('write', {
                path: 'jre.json',
                data,
            }, { root: true })
        },
        async add(context, java) {
            if (context.getters.has(java)) return;
            const valid = await context.dispatch('validate', java);
            context.commit('add', valid);
            if (!valid.valid) context.commit('addToFailed', valid)
            await context.dispatch('save');
        },
        setDefault(context, defaultJre) {
            context.commit(defaultJre);
        },
        remove(context, java) {
        },
        validate(context, path) {
            return context.dispatch('query', {
                service: 'jre',
                action: 'validate',
                payload: path,
            }, { root: true });
        },
        /**
         * scan local java locations and cache
         */
        async refresh(context) {
            const all = await context.dispatch('query', {
                service: 'jre',
                action: 'availableJre',
            }, { root: true })
            const allJre = await Promise.all(Object.keys(all).map(j => context.dispatch('validate', j)));
            allJre.forEach((j) => {
                context.commit('addToDetected', j);
                if (!j.valid) context.commit('addToFailed', j)
            });
        },
        downloadJavas(context) {
        },
    },
}
