import Router, { Route } from 'vue-router';
import Vue from 'vue';
import { shell } from 'renderer/constant';
import HomePage from './pages/HomePage.vue';
import ProfilePage from './pages/ProfilesPage.vue';
import SettingPage from './pages/SettingPage.vue';
import UserPage from './pages/UserPage.vue';
import SaveViewPage from './pages/SaveViewPage.vue';
import BaseSettingPage from './pages/BaseSettingPage.vue';
import AdvancedSettingPage from './pages/AdvancedSettingPage.vue';
import ModSettingPage from './pages/ModSettingPage.vue';
import GameSettingPage from './pages/GameSettingPage.vue';
import ResourcePackSettingPage from './pages/ResourcePackSettingPage.vue';
import VersionSettingPage from './pages/VersionSettingPage.vue';
import CurseforgePage from './pages/CurseforgePage.vue';
import CurseforgeViewPage from './pages/CurseforgeViewPage.vue';
import CurseforgeProjectPage from './pages/CurseforgeProjectPage.vue';

Vue.use(Router);

const router = new Router({
    routes: [
        {
            path: '/',
            component: HomePage,
        },
        {
            path: '/profiles',
            component: ProfilePage,
        },
        {
            path: '/setting',
            component: SettingPage,
        },
        {
            path: '/user',
            component: UserPage,
        },
        {
            path: '/save',
            component: SaveViewPage,
        },
        {
            path: '/base-setting',
            component: BaseSettingPage,
        },
        {
            path: '/advanced-setting',
            component: AdvancedSettingPage,
        },
        {
            path: '/mod-setting',
            component: ModSettingPage,
        },
        {
            path: '/game-setting',
            component: GameSettingPage,
        },
        {
            path: '/resource-pack-setting',
            component: ResourcePackSettingPage,
        },
        {
            path: '/version-setting',
            component: VersionSettingPage,
        },
        {
            path: '/curseforge',
            component: CurseforgePage,
        },
        {
            path: '/curseforge/:type',
            component: CurseforgeViewPage,
            props: true,
        },
        {
            path: '/curseforge/:type/:id',
            component: CurseforgeProjectPage,
            props: true,
        },
    ],
} as any);

router.beforeEach((to: Route, from: Route, next) => {
    const full = to.fullPath.substring(1);
    if (full.startsWith('https:') || full.startsWith('http:') || full.startsWith('external')) {
        console.log(`Prevent ${from.fullPath} -> ${to.fullPath}`);
        next(false);
        if (full.startsWith('external')) {
            console.log(full.substring('external/'.length));
            shell.openExternal(full.substring('external/'.length));
        } else {
            console.log(full);
            shell.openExternal(full);
        }
    } else {
        console.log(`Route ${from.fullPath} -> ${to.fullPath}`);
        next();
    }
});


export default router;
