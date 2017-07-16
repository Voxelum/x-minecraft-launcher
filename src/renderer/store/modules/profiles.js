import { Store } from 'vuex'
import singleSelect from './models/single-select'
import modelProfile from './models/profile'

const obj = Object.assign({}, singleSelect)

obj.mutations.create = function(state, name) {
    const newProfile = new Store(modelProfile)
    newProfile.commit('setName', name)
    state.commit('add', newProfile)
}

export default obj
