import paths from 'path'

export default {
    /**
     * Return the errros by module.
     * @param {CreateOption} state
     */
    errors: (state, getters, rootState) => {
        const settings = []
        if (rootState.java.javas.length !== 0) settings.push('setting.install.java')
        const errors = {
        }
        Object.keys(rootState)
            .filter(key => getters[`${key}/errors`] && getters[`${key}/errors`].length !== 0)
            .forEach((key) => { errors[key] = getters[`${key}/errors`] });
        if (settings.length !== 0) errors.settings = settings;
        return errors;
    },
    tasks(state, getters) {
        return {}
    },
    errorsCount: (state, getters) => Object.keys(getters.errors)
        .map((k, i, arr) => getters.errors[k].length).reduce((a, b) => a + b, 0),
    tasksCount: (states, getters) => Object.keys(getters.tasks)
        .map((k, i, arr) => getters.tasks[k].length).reduce((a, b) => a + b, 0),
    root: state => state.root,
    options: state => state.templates.minecraft,
    defaultOptions: state => state.templates.minecraft.midum,
}
