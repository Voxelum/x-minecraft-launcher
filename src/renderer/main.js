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
    ipcRenderer.on('init', (event, root) => {
        store(root).then(s =>
            new Vue({
                router: require('./router.js').default,
                components: { App },
                store: s,
                i18n: require('./i18n').default,
                template: '<App style="max-height:626px; overflow:hidden;"></App>',
            }).$mount('#app'),
        )
    })
    ipcRenderer.send('init')
}

