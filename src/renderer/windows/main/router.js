import Router from 'vue-router';
import Vue from 'vue';
import { remote } from 'electron';
import Main from './Main';

Vue.use(Router);

const router = new Router({
    routes: [
        {
            path: '/',
            component: Main,
            children: [
                {
                    path: '/',
                    component: () => import('./HomePage'),
                },
                {
                    path: '/profiles',
                    component: () => import('./ProfilesPage'),
                },
                {
                    path: '/setting',
                    component: () => import('./SettingPage'),
                },
                {
                    path: '/user',
                    component: () => import('./UserPage'),
                },
                {
                    path: '/login',
                    component: () => import('./LoginPage'),
                },
                {
                    path: '/save',
                    component: () => import('./SaveViewPage'),
                },
                {
                    path: '/server',
                    component: () => import('./ServerViewPage'),
                },
                {
                    path: '/base-setting',
                    component: () => import('./BaseSettingPage'),
                },
                {
                    path: '/advanced-setting',
                    component: () => import('./AdvancedSettingPage'),
                },
                {
                    path: '/mod-setting',
                    component: () => import('./ModSettingPage'),
                },
                {
                    path: '/game-setting',
                    component: () => import('./GameSettingPage'),
                },
                {
                    path: '/resource-pack-setting',
                    component: () => import('./ResourcePackSettingPage'),
                },
                {
                    path: '/version-setting',
                    component: () => import('./VersionSettingPage'),
                },
                {
                    path: '/curseforge',
                    component: () => import('./CurseforgePage'),
                },
                {
                    path: '/curseforge/:type',
                    component: () => import('./CurseforgeViewPage'),
                    props: true,
                },
                {
                    path: '/curseforge/:type/:id',
                    component: () => import('./CurseforgeProjectPage'),
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
