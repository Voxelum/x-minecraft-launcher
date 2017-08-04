export default (store) => {
    store.subscribe((mutation, state) => {
        const type = mutation.type
        if (type.endsWith('$reload')) return
        const moduleId = type.substring(0, type.indexOf('/'))
        const action = `${moduleId}/save`
        if (store._actions[action]) {
            store.dispatch(action, { mutation: type, object: mutation.payload }).then(() => {
                console.log(`Module [${moduleId}] saved by ${type}`);
            },
                (err) => {
                    console.warn(`Module [${moduleId}] saving occured an error:`)
                    console.warn(err)
                })
                .catch((err) => {
                    console.warn(`Module [${moduleId}] saving occured an error:`)
                    console.warn(err)
                });
        }
    });
}
