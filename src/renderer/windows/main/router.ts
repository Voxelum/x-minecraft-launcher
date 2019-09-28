import Router from 'vue-router';
import Vue from 'vue';
import { remote } from 'electron';
import MainWindow from './MainWindow.vue';

Vue.use(Router);

const router = new Router({
    routes: [
        {
            path: '/',
            component: MainWindow,
            children: [
                {
                    path: '/',
                    component: () => import('./pages/HomePage.vue'),
                },
                {
                    path: '/profiles',
                    component: () => import('./pages/ProfilesPage.vue'),
                },
                {
                    path: '/setting',
                    component: () => import('./pages/SettingPage.vue'),
                },
                {
                    path: '/user',
                    component: () => import('./pages/UserPage.vue'),
                },
                {
                    path: '/save',
                    component: () => import('./pages/SaveViewPage.vue'),
                },
                {
                    path: '/base-setting',
                    component: () => import('./pages/BaseSettingPage.vue'),
                },
                {
                    path: '/advanced-setting',
                    component: () => import('./pages/AdvancedSettingPage.vue'),
                },
                {
                    path: '/mod-setting',
                    component: () => import('./pages/ModSettingPage.vue'),
                },
                {
                    path: '/game-setting',
                    component: () => import('./pages/GameSettingPage.vue'),
                },
                {
                    path: '/resource-pack-setting',
                    component: () => import('./pages/ResourcePackSettingPage.vue'),
                },
                {
                    path: '/version-setting',
                    component: () => import('./pages/VersionSettingPage.vue'),
                },
                {
                    path: '/curseforge',
                    component: () => import('./pages/CurseforgePage.vue'),
                },
                {
                    path: '/curseforge/:type',
                    component: () => import('./pages/CurseforgeViewPage.vue'),
                    props: true,
                },
                {
                    path: '/curseforge/:type/:id',
                    component: () => import('./pages/CurseforgeProjectPage.vue'),
                    props: true,
                },
            ],
        },
    ],
});

router.beforeEach((to, from, next) => {
    const full = to.fullPath.substring(1);
    if (full.startsWith('https:') || full.startsWith('http:') || full.startsWith('external')) {
        console.log(`Prevent ${from.fullPath} -> ${to.fullPath}`);
        next(false);
        if (full.startsWith('external')) {
            console.log(full.substring('external/'.length));
            remote.shell.openExternal(full.substring('external/'.length));
        } else {
            console.log(full);
            remote.shell.openExternal(full);
        }
    } else {
        console.log(`Route ${from.fullPath} -> ${to.fullPath}`);
        next();
    }
});


export default router;
