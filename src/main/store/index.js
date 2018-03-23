import Vue from 'vue'
import Vuex from 'vuex'
import store from '../../universal/store'
import plugins from './plugins'

store.plugins.push(...plugins);

Vue.use(Vuex);

/**
 * 
 * @param {Vuex.Module} mo 
 * @param {Array<string>} container 
 */
function discoverLoader(mo, path, container) {
    if (mo.actions && mo.actions.load) {
        container.push([...path, 'load'].join('/'));
    }
    if (mo.modules) {
        Object.keys(mo.modules).forEach((k) => {
            discoverLoader(mo.modules[k], [...path, k], container);
        })
    }
    return container;
}

let _loading = false;

export function loading() { return _loading }
export function moduleGuards() { }
/**
 * 
 * @param {string} root 
 * @returns {Promise<Vuex.Store>}
 */
function load(root) {
    const loaders = discoverLoader(store, [], []);
    store.state.root = root;
    _loading = true;
    const st = new Vuex.Store(store);

    return Promise.all(loaders.map((key) => {
        const action = key;
        if (st._actions[action]) {
            console.log(`Found loading action [${action}]`)
            return st.dispatch(action).then((instance) => {
                console.log(`Loaded [${key}]`)
            }, (err) => {
                console.error(`An error occured when we load module [${key.substring(0, key.indexOf('/'))}].`)
                console.error(err)
            })
        }
        return Promise.resolve();
    })).then(() => {
        _loading = false;
        console.log('Done loading store!')
        return st
    }, (err) => {
        _loading = false;
        console.log('Done loading store with Error')
        console.log(err)
        return st
    })
}

export default load;
