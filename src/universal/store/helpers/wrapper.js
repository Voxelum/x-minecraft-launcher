

export default
    /**
     * @param {ActionContext} context
     * @return {TaskModule}
     */
    context => ({
        create(payload) {
            return context.dispatch('task/create', payload, { root: true })
        },
        update(payload) { context.commit('task/update', payload, { root: true }) },
        finish(payload) { context.commit('task/finish', payload, { root: true }) },
        error(payload) { context.commit('task/error', payload, { root: true }) },
    })
