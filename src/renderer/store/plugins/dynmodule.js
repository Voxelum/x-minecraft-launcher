import uuid from 'uuid'

export default (store) => {
    store.subscribe((mutation, state) => {
        const type = mutation.type;
        const payload = mutation.payload;
        let paths = type.split('/');
        const func = paths[paths.length - 1];
        paths = paths.slice(0, paths.length - 1)
        if (func === 'add') {
            const { id, module } = payload;
            paths.push(id)
            if (!module.namespaced) module.namespaced = true;
            store.registerModule(paths, module);
        } else if (func === 'remove') {
            console.log(`payload ${payload}`)
            paths.push(payload)
            store.unregisterModule(paths);
        }
    })
}
