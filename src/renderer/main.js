import Vue from 'vue';
import url from 'url'
import Vuex from 'vuex';
import querystring from 'querystring'
import fs from 'fs-extra'
import { webFrame, ipcRenderer } from 'electron'

webFrame.setVisualZoomLevelLimits(1, 1)

Vue.use({
    install(instance) {
        Vue.prototype.$ipc = ipcRenderer;
        Vue.prototype.$mapGetters = Vuex.mapGetters;
        Vue.prototype.$mapActions = Vuex.mapActions;
    },
})

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false;

const { logger, root } = querystring.parse(url.parse(document.URL).query)

if (logger === 'true') {
    new Vue({
        components: { Log: require('./LogViewer') },
        template: '<Log></Log>',
    }).$mount('#app');
} else {
    (async () => {
        const storeOptions = require('./store').default;
        const router = require('./router.js').default;
        const ui = require('./ui').default;
        const themes = ui.map(gui => gui.path.substring(1));

        storeOptions.state.root = root;
        storeOptions.modules.appearance.state.themes = themes;

        const mainModules = storeOptions.modules;

        const store = new Vuex.Store(storeOptions);

        await Promise.all(Object.keys(mainModules).map((key) => {
            const action = `${key}/load`;
            if (store._actions[action]) {
                console.log(`Found loading action [${action}]`)
                return store.dispatch(action).then((instance) => {
                    console.log(`Loaded module [${key}]`)
                }, (err) => {
                    console.error(`An error occured when we load module [${key}].`)
                    console.error(err)
                })
            }
            return Promise.resolve();
        }))
        console.log('Finish root modules loading')
        new Vue({
            router,
            components: { App: require('./App') },
            store,
            i18n: store.getters.i18n,
            template: '<App style="max-height:626px; overflow:hidden;"></App>',
        }).$mount('#app')
    })()
}

