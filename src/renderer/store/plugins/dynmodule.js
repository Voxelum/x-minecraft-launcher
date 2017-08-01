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
            if (!id) {
                console.error(`Unexpect empty id for adding! @${mutation.type}`)
                return
            }
            if (!module) {
                console.error(`Unexpect empty module for adding! @${mutation.type}`)
                return
            }
            paths.push(id)
            if (!module.namespaced) module.namespaced = true;
            store.registerModule(paths, module);
            // store.dispatch(`${paths}/load`)
        } else if (func === 'remove') {
            console.log(`payload ${payload}`)
            if (!payload) {
                console.error(`Unexpect empty payload for removal! @${mutation.type}`)
                return
            }
            paths.push(payload)
            store.unregisterModule(paths);
        }
    })
}
