import Vue from 'vue'
import Router from 'vue-router'
import { shell } from 'electron'
import routes from './ui'

Vue.use(Router)

const router = new Router({
    routes: [{
        path: '/',
        name: 'home',
        redirect: '/semantic',
    }, ...routes],
})

router.beforeEach((to, from, next) => {
    if (to && to.path.startsWith('/http')) {
        shell.openExternal(to.path.substring(1));
        next(false);
    } else if (next) next()
})

export default router;
