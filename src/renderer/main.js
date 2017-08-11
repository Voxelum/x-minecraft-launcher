import Vue from 'vue';
import { ipcRenderer } from 'electron'
import App from './App.vue'
import store from './store'
import i18n from './i18n';


if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}

Vue.config.productionTip = false;

(() => {
    ipcRenderer.send('ping');
    const first = Date.now()
    ipcRenderer.once('pong', () => {
        const time = Date.now() - first
        console.debug(`spend ${time} ms`)
    })
})();

ipcRenderer.on('init', (event, root) => {
    store(root).then(s =>
        new Vue({
            components: { App },
            store: s,
            i18n,
            template: '<App style="max-height:626px; overflow:hidden;"></App>',
        }).$mount('#app'),
    )
})
ipcRenderer.send('init')
