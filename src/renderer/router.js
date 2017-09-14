import Vue from 'vue'
import Router from 'vue-router'

import routes from './ui'

Vue.use(Router)

const router = new Router({
    routes: [{
        path: '/',
        name: 'home',
        redirect: '/semantic',
    }, ...routes],
})

export default router;
