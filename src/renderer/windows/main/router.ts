import { getServiceProxy } from '/@/providers/provideServiceProxy'
import Router from 'vue-router'
import BaseSettingPage from './pages/BaseSettingPage.vue'
import CurseforgePage from './pages/CurseforgePage.vue'
import CurseforgeProjectPage from './pages/CurseforgeProjectPage.vue'
import CurseforgeViewPage from './pages/CurseforgeViewPage.vue'
import GameSettingPage from './pages/GameSettingPage.vue'
import HomePage from './pages/HomePage.vue'
import InstancesPage from './pages/InstancesPage.vue'
import ModSettingPage from './pages/ModSettingPage.vue'
import ResourcePackSettingPage from './pages/ResourcePackSettingPage.vue'
import ResourcePackPreviewPage from './pages/ResourcePackPreviewPage.vue'
import SaveViewPage from './pages/SaveViewPage.vue'
import SettingPage from './pages/SettingPage.vue'
import UserPage from './pages/UserPage.vue'
import VersionSettingPage from './pages/VersionSettingPage.vue'
import MCWikiPage from './pages/MCWikiPage.vue'
import { BaseServiceKey } from '/@shared/services/BaseService'

const router = new Router({
  routes: [
    {
      path: '/',
      component: HomePage,
    },
    {
      path: '/instances',
      component: InstancesPage,
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
      path: '/resource-pack-preview',
      component: ResourcePackPreviewPage,
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
      props: (route) => ({ keyword: route.query.keyword, page: Number.parseInt(route.query.page as any ?? '1', 10), type: route.path.split('/')[2], from: route.query.from }),
    },
    {
      path: '/curseforge/:type/:id',
      component: CurseforgeProjectPage,
      props: (route) => ({ type: route.path.split('/')[2], id: route.path.split('/')[3], from: route.query.from }),
    },
    {
      path: '/mcwiki',
      component: MCWikiPage,
      props: (route) => ({ path: route.query.path }),
    },
  ],
})

router.beforeEach((to, from, next) => {
  const full = to.fullPath.substring(1)
  const { openInBrowser } = getServiceProxy(BaseServiceKey)
  if (full.startsWith('https:') || full.startsWith('http:') || full.startsWith('external')) {
    next(false)
    console.log(`Prevent ${from.fullPath} -> ${to.fullPath}`)
    if (full.startsWith('external')) {
      console.log(full.substring('external/'.length))
      openInBrowser(full.substring('external/'.length))
    } else {
      openInBrowser(full)
    }
  } else {
    console.log(`Route ${from.fullPath} -> ${to.fullPath}`)
    next()
  }
})

export default router
