import Router from 'vue-router'
import root from './pages'
import baseSetting from './pages/base-setting'
import curseforge from './pages/curseforge'
import curseforgeType from './pages/curseforge/[type]'
import curseforgeTypeId from './pages/curseforge/[type]/[id]'
import gameSetting from './pages/game-setting'
import instances from './pages/instances'
import mcwiki from './pages/mcwiki'
import modSetting from './pages/mod-setting'
import resourcePackPreview from './pages/resource-pack-preview'
import resourcePackSetting from './pages/resource-pack-setting'
import shaderPackSetting from './pages/shader-pack-setting'
import save from './pages/save'
import setting from './pages/setting'
import user from './pages/user'
import versionSetting from './pages/version-setting'

const router = new Router({
  routes: [
    {
      path: '/',
      component: root,
    },
    {
      path: '/instances',
      component: instances,
    },
    {
      path: '/setting',
      component: setting,
    },
    {
      path: '/user',
      component: user,
    },
    {
      path: '/save',
      component: save,
    },
    {
      path: '/base-setting',
      component: baseSetting,
    },
    {
      path: '/mod-setting',
      component: modSetting,
    },
    {
      path: '/game-setting',
      component: gameSetting,
    },
    {
      path: '/resource-pack-setting',
      component: resourcePackSetting,
    },
    {
      path: '/shader-pack-setting',
      component: shaderPackSetting,
    },
    {
      path: '/resource-pack-preview',
      component: resourcePackPreview,
    },
    {
      path: '/version-setting',
      component: versionSetting,
    },
    {
      path: '/curseforge',
      component: curseforge,
    },
    {
      path: '/curseforge/:type',
      component: curseforgeType,
      props: (route) => ({ keyword: route.query.keyword, page: Number.parseInt(route.query.page as any ?? '1', 10), type: route.path.split('/')[2], from: route.query.from }),
    },
    {
      path: '/curseforge/:type/:id',
      component: curseforgeTypeId,
      props: (route) => ({ type: route.path.split('/')[2], id: route.path.split('/')[3], from: route.query.from }),
    },
    {
      path: '/mcwiki',
      component: mcwiki,
      props: (route) => ({ path: route.query.path }),
    },
  ],
})

export default router
