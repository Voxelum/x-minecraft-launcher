import Vue from 'vue';
import { ipcRenderer } from 'electron'
import store from './store'
import i18n from './i18n';
import Log from './LogViewer'

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false;

new Vue({
    components: { Log },
    i18n,
    template: '<Log></Log>',
}).$mount('#log');