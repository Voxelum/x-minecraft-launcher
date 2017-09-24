import Vue from 'vue';
import url from 'url'
import querystring from 'querystring'

if (!process.env.IS_WEB) {
    Vue.use(require('vue-electron'))
}
Vue.config.productionTip = false;

const { logger, theme, root } = querystring.parse(url.parse(document.URL).query)

if (logger === 'true') {
    new Vue({
        components: { Log: require('./LogViewer') },
        template: '<Log></Log>',
    }).$mount('#log');
} else {
    const createStore = require('./store').default;
    const router = require('./router.js').default;
    const ui = require('./ui').default;
    createStore(root, ui.map(gui => gui.path.substring(1)), theme).then(store =>
        new Vue({
            router,
            components: { App: require('./App') },
            store,
            i18n: require('./i18n').default,
            template: '<App style="max-height:626px; overflow:hidden;"></App>',
        }).$mount('#app'),
    ).then((v) => {
        console.log(v.$route.fullPath)
        v.$store.commit('url', v.$route.fullPath)
        v.$router.afterEach((to, from) => {
            console.log(to.fullPath)
            v.$store.commit('url', to.fullPath)
        })
    })
}

