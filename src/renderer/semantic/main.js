import Vue from 'vue';
import Vuex, { mapGetters, mapActions } from 'vuex';
import url from 'url'
import i18n from 'universal/i18n';
import querystring from 'querystring'
import { webFrame, ipcRenderer } from 'electron'

webFrame.setVisualZoomLevelLimits(1, 1)

Vue.use({
    install(instance) {
        Vue.prototype.$ipc = ipcRenderer;
        Vue.prototype.$openDialog = option => instance.$store.dispatch('openDialog', option);
        Vue.prototype.$saveDialog = option => instance.$store.dispatch('saveDialog', option);
    },
})

$.mapGetters = mapGetters;
$.mapActions = mapActions;


if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false;

const { logger } = querystring.parse(url.parse(document.URL).query)

if (logger === 'true') {
    new Vue({
        components: { Log: require('./LogViewer') },
        template: '<Log></Log>',
    }).$mount('#app');
} else {
    const store = require('./store').default
    const router = require('./router.js').default;

    console.log(`client ${store.state.root}`);

    new Vue({
        router,
        components: { App: require('./App').default },
        store,
        i18n: i18n(store),
        template: '<App style="max-height:626px; overflow:hidden;"/>',
    }).$mount('#app')
}

