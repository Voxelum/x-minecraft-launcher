import launcher from '../../launcher'

export default (store) => {
    store.subscribe((mutation, state) => {
        const type = mutation.type
        if (type.endsWith('$reload')) return
        const moduleId = type.substring(0, type.indexOf('/'))
        store.dispatch(`${moduleId}/save`, { mutation: type, object: mutation.payload }).then(() => {
            console.log(`Module [${moduleId}] saved`);
        },
            (err) => {
                console.warn(`Module [${moduleId}] saving occured an error:`)
                console.warn(err)
            })
            .catch((err) => {
                console.warn(`Module [${moduleId}] saving occured an error:`)
                console.warn(err)
            });
    });
}
