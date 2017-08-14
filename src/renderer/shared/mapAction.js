import vuex from 'vuex'


function normalizeMap(map) {
    return Array.isArray(map)
        ? map.map(key => ({ key, val: key }))
        : Object.keys(map).map(key => ({ key, val: map[key] }))
}

function normalizeNamespace(fn) {
    return (namespace, map) => {
        if (typeof namespace !== 'string') {
            map = namespace
            namespace = ''
        } else if (namespace.charAt(namespace.length - 1) !== '/') {
            namespace += '/'
        }
        return fn(namespace, map)
    }
}

function getModuleByNamespace(store, helper, namespace) {
    const module = store._modulesNamespaceMap[namespace]
    if (!module) {
        console.error(`[vuex] module namespace not found in ${helper}(): ${namespace}`)
    }
    return module
}

export const mapActions = normalizeNamespace((namespace, actions) => {
    const res = {}
    normalizeMap(actions).forEach(({ key, val }) => {
        val = namespace + val
        res[key] = function mappedAction(...args) {
            if (namespace && !getModuleByNamespace(this.$store, 'mapActions', namespace)) {
                return null;
            }
            const loc = [val].concat(args)
            this.$store.commit('tasks/addTask', loc)
            return this.$store.dispatch.apply(this.$store, loc)
                .then((v) => {
                    this.$store.commit('tasks/deleteTask', loc)
                    return v
                })
        }
    })
    return res
})

export default mapActions
