import Vue from 'vue';
import { ipcRenderer } from 'electron'

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false;

if (SIDE === 'log') {
    new Vue({
        components: { Log: require('./LogViewer') },
        template: '<Log></Log>',
    }).$mount('#log');
} else {
    // require('default-passive-events')
    const App = require('./App');
    const store = require('./store').default;
    const router = require('./router.js').default;
    ipcRenderer.on('init', (event, root) => {
        store(root).then(s =>
            new Vue({
                router,
                components: { App },
                store: s,
                i18n: require('./i18n').default,
                template: '<App style="max-height:626px; overflow:hidden;"></App>',
            }).$mount('#app'),
        ).then((v) => {
            v.$store.commit('path', v.$route.fullPath)
            v.$router.afterEach((to, from) => {
                v.$store.commit('path', to.fullPath)
            })
        })
    })
    ipcRenderer.send('init')
}

