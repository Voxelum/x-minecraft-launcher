import Vue from 'vue'
import Router from 'vue-router'

import routes from './ui'

Vue.use(Router)

export default new Router({

    routes: [{
        path: '/',
        name: 'home',
        redirect: '/semantic',
    }, ...routes],
    beforeEach({ to, from }) {
    },
})
