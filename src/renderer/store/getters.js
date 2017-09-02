import paths from 'path'

export default {
    /**
     * Return the errros by module.
     * @param {* State} state The vuex root state
     * @param {* Getters} getters The vuex root getters
     */
    errors(state, getters) {
        const errors = {}
        for (const key in state) {
            if (state.hasOwnProperty(key)) {
                const get = getters[`${key}/errors`]
                if (get && get.length !== 0) {
                    errors[key] = get
                }
            }
        }
        return errors;
    },
    errorsCount(state, getters) {
        return Object.keys(getters.errors).map((k, i, arr) => getters.errors[k].length)
            .reduce((a, b) => a + b, 0)
    },
    tasks(state, getters) {
        return {}
    },
    tasksCount(states, getters) {
        return Object.keys(getters.tasks).map((k, i, arr) => getters.tasks[k].length)
            .reduce((a, b) => a + b, 0)
    },
    rootPath(state, getters) {
        return state.root
    },
    path: (state, gets) => path => (path instanceof Array ?
        paths.join(gets.rootPath, ...path) : paths.join(gets.rootPath, path)),
}
