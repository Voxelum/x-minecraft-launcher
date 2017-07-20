import uuid from 'uuid'

import mixin from '../mixin-state'
import singleSelect from './models/single-select'
import modelServer from './models/server'
import modelModpack from './models/modpack'

export default {
    namespaced: true,
    state() {
        return singleSelect.state()
    },
    getters: {
        ...singleSelect.getters,
    },
    mutations: {
        ...singleSelect.mutations,
    },
    actions: {
        create(context, {
            type,
            option,
        }) {
            if (type === 'server') {
                context.commit('add', { id: uuid(), module: mixin(modelServer, option) })
            } else if (type === 'modpack') {
                option.name = 'New Modpack'
                option.ediable = true
                option.author = 'ci010'
                option.description = 'no description yet!'                
                context.commit('add', { id: uuid(), module: mixin(modelModpack, option) })
            }
        },
    },
}
