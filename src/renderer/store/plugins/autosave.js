import launcher from '../../launcher'

export default (store) => {
    store.subscribe((mutation, state) => {
        const type = mutation.type
        if (type.endsWith('$reload')) return
        const moduleId = type.substring(0, type.indexOf('/'))
        launcher.update(moduleId, mutation, state[moduleId])
    });
}
