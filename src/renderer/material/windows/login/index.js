import select from 'universal/store/selector'
import Vuex from 'vuex'
import router from './router'

const storeOption = select({ modules: ['user', 'config'] });

console.log(storeOption)

const store = new Vuex.Store(storeOption);
console.log(Object.keys(store._mutations))

export default {
    router,
}
