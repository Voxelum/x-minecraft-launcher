import launcher from '../../launcher'

export default (store) => {
    store.subscribe((mutation, state) => {
        const type = mutation.type
        if (type.endsWith('$reload')) return
        const moduleId = type.substring(0, type.indexOf('/'))
        store.dispatch(`${moduleId}/save`, { mutation: type }).then(() => {
            console.log(`module ${moduleId} saved`);
        },
            (err) => {
                console.warn(`module ${moduleId} saving occured an error:`)
                console.warn(err)
            });
    });
}
