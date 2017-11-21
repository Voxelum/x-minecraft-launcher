import Vue from 'vue'
import Router from 'vue-router'
import { shell } from 'electron'
import routes from './ui'

Vue.use(Router)

const router = new Router({
    routes: [...routes],
})

router.beforeEach((to, from, next) => {
    if (to && to.path.startsWith('/external/')) {
        shell.openExternal(to.path.substring('/external/'.length));
        next(false);
    } else if (next) next()
})

export default router;
