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
        let count = 0
        const errors = getters.errors
        for (const key in errors) {
            if (errors.hasOwnProperty(key)) {
                count += errors[key].length
            }
        }
        return count
    },
    tasks(state, getters) {
        return []
    },
    rootPath(state, getters) {
        return state.root
    },
    path: (state, gets) => path => (path instanceof Array ?
        paths.join(gets.rootPath, ...path) : paths.join(gets.rootPath, path)),
}
