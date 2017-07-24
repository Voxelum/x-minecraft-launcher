import repository from './models/repository'

export default {
    state() {
        const state = repository.state()
        state.root = 'resourcepacks'
        return state
    },
    getters: repository.getters,
    mutation: repository.repository,
    actions: Object.assign({
        save(context, payload) {
            const { mutation } = payload;
            context.dispatch('')
        },
        load() { },
    }, repository.actions),
}
