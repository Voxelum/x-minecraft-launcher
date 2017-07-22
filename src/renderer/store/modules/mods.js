import multiSelect from './models/multi-select'
import mod from './models/mod'

const obj = Object.assign({}, multiSelect)

obj.actions = {
    import(context, payload) {
        return context.dispatch('query', { service: 'mod', action: 'import', payload });
    },
    export(context, payload) {
        return context.dispatch('query', { service: 'mod', action: 'export', payload });
    },
}

export default obj
