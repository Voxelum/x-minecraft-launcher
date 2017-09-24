import Vue from 'vue';
import { ipcRenderer } from 'electron'

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false;

// eslint-disable-next-line no-undef
if (SIDE === 'log') {
    new Vue({
        components: { Log: require('./LogViewer') },
        template: '<Log></Log>',
    }).$mount('#log');
} else {
    const createStore = require('./store').default;
    const router = require('./router.js').default;
    const ui = require('./ui').default;
    ipcRenderer.on('init', (event, root) => {
        createStore(root, ui.map(gui => gui.path)).then(store =>
            new Vue({
                router,
                components: { App: require('./App') },
                store,
                i18n: require('./i18n').default,
                template: '<App style="max-height:626px; overflow:hidden;"></App>',
            }).$mount('#app'),
        ).then((v) => {
            v.$store.commit('url', v.$route.fullPath)
            v.$router.afterEach((to, from) => {
                v.$store.commit('url', to.fullPath)
            })
        })
    })
    ipcRenderer.send('init')
}

