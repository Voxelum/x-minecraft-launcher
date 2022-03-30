import Router from 'vue-router'
import Home from './views/Home.vue'
import Instances from './views/Instances.vue'
import Setting from './views/Setting.vue'
import User from './views/User.vue'
import Save from './views/Save.vue'
import BaseSetting from './views/BaseSetting.vue'
import Mod from './views/Mod.vue'
import GameSetting from './views/GameSetting.vue'
import ResourcePack from './views/ResourcePack.vue'
import ShaderPack from './views/ShaderPack.vue'
import Version from './views/Version.vue'
import Modpack from './views/Modpack.vue'
import Curseforge from './views/Curseforge.vue'
import CurseforgeProject from './views/CurseforgeProject.vue'
import Modrinth from './views/Modrinth.vue'
import ModrinthProject from './views/ModrinthProject.vue'

export const createRouter = () => {
  const router = new Router({
    routes: [
      {
        path: '/',
        component: Home,
      },
      {
        path: '/instances',
        component: Instances,
      },
      {
        path: '/setting',
        component: Setting,
      },
      {
        path: '/user',
        component: User,
      },
      {
        path: '/save',
        component: Save,
      },
      {
        path: '/base-setting',
        component: BaseSetting,
      },
      {
        path: '/mod-setting',
        component: Mod,
      },
      {
        path: '/game-setting',
        component: GameSetting,
      },
      {
        path: '/resource-pack-setting',
        component: ResourcePack,
      },
      {
        path: '/shader-pack-setting',
        component: ShaderPack,
      },
      // {
      //   path: '/resource-pack-preview',
      //   component: resourcePackPreview,
      // },
      {
        path: '/version-setting',
        component: Version,
      },
      {
        path: '/modpack-setting',
        component: Modpack,
      },
      {
        path: '/curseforge/:type',
        component: Curseforge,
        props: (route) => ({
          from: route.query.from,
          type: route.path.split('/')[2],
          page: Number.parseInt(route.query.page as any ?? '1', 10),
          keyword: route.query.keyword,
          category: route.query.category,
          sort: route.query.sort,
          gameVersion: route.query.gameVersion ?? '',
        }),
      },
      {
        path: '/curseforge/:type/:id',
        component: CurseforgeProject,
        props: (route) => ({ type: route.path.split('/')[2], id: route.path.split('/')[3], from: route.query.from }),
      },
      {
        path: '/modrinth',
        component: Modrinth,
        props: (route) => ({
          query: route.query.query,
          gameVersion: route.query.gameVersion,
          license: route.query.license,
          category: route.query.category,
          modLoader: route.query.modLoader,
          environment: route.query.environment,
          sortBy: route.query.sortBy,
          projectType: route.query.projectType,
          page: Number.parseInt(route.query.page as any ?? '1', 10),
          from: route.query.from,
        }),
      },
      {
        path: '/modrinth/:id',
        component: ModrinthProject,
        props: (route) => ({ id: route.path.split('/')[2] }),
      },
    ],
  })
  return router
}
