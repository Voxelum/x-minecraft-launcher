import BaseSetting from '@/views/BaseSetting.vue'
import Home from '@/views/Home.vue'
import HomeActions from '@/views/HomeActions.vue'
import HomeExtension from '@/views/HomeExtension.vue'
import HomeLayout from '@/views/HomeLayout.vue'
import Me from '@/views/Me.vue'
import Mod from '@/views/Mod.vue'
import ModActions from '@/views/ModActions.vue'
import ModExtension from '@/views/ModExtension.vue'
import Multiplayer from '@/views/Multiplayer.vue'
import ResourceManage from '@/views/ResourceManage.vue'
import ResourcePack from '@/views/ResourcePack.vue'
import ResourcePackActions from '@/views/ResourcePackActions.vue'
import ResourcePackExtension from '@/views/ResourcePackExtension.vue'
import Save from '@/views/Save.vue'
import SaveExtension from '@/views/SaveExtension.vue'
import Setting from '@/views/Setting.vue'
import ShaderPack from '@/views/ShaderPack.vue'
import ShaderPackActions from '@/views/ShaderPackActions.vue'
import ShaderPackExtension from '@/views/ShaderPackExtension.vue'
import Store from '@/views/Store.vue'
import StoreEntry from '@/views/StoreEntry.vue'
import StoreProjectCurseforge from '@/views/StoreProjectCurseforge.vue'
import StoreProjectModrinth from '@/views/StoreProjectModrinth.vue'
import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)
export const router = new Router({
  routes: [
    {
      path: '/',
      component: HomeLayout,
      children: [
        {
          path: '/',
          components: {
            default: Home,
            extensions: HomeExtension,
            actions: HomeActions,
          },
        },
        {
          path: '/save',
          components: {
            default: Save,
            extensions: SaveExtension,
          },
        },
        {
          path: '/mods',
          components: {
            default: Mod,
            extensions: ModExtension,
            actions: ModActions,
          },
        },
        {
          path: '/resource-pack-setting',
          components: {
            default: ResourcePack,
            extensions: ResourcePackExtension,
            actions: ResourcePackActions,
          },
        },
        {
          path: '/shader-pack-setting',
          components: {
            default: ShaderPack,
            extensions: ShaderPackExtension,
            actions: ShaderPackActions,
          },
        },
        {
          path: '/base-setting',
          components: {
            default: BaseSetting,
            extensions: HomeExtension,
            actions: HomeActions,
          },
        },
      ],
    },
    {
      path: '/store',
      component: Store,
      children: [
        {
          path: '/',
          component: StoreEntry,
        },
        {
          path: '/store/modrinth/:id',
          component: StoreProjectModrinth,
          props: (route) => ({ id: route.path.split('/')[3] }),
        },
        {
          path: '/store/curseforge/:id',
          component: StoreProjectCurseforge,
          props: (route) => ({ id: Number(route.path.split('/')[3]) }),
        },
      ],
    },
    {
      path: '/setting',
      component: Setting,
    },
    {
      path: '/me',
      component: Me,
    },
    {
      path: '/instances',
      component: () => import('@/views/Instances.vue'),
    },
    {
      path: '/multiplayer',
      component: Multiplayer,
    },
    {
      path: '/local-resources',
      component: ResourceManage,
    },
    // {
    //   path: '/ftb',
    //   component: FeedTheBeast,
    //   props: (route) => ({ keyword: route.query.keyword }),
    // },
    // {
    //   path: '/ftb/:id',
    //   component: FeedTheBeastProject,
    //   props: (route) => ({ id: Number(route.params.id) }),
    // },
    // {
    //   path: '/curseforge/:type',
    //   component: Curseforge,
    //   props: (route) => ({
    //     from: route.query.from,
    //     type: route.path.split('/')[2],
    //     page: Number.parseInt(route.query.page as any ?? '1', 10),
    //     keyword: route.query.keyword,
    //     modLoaderType: route.query.modLoaderType ? Number.parseInt(route.query.modLoaderType as any, 10) : undefined,
    //     sortOrder: route.query.sortOrder ? Number.parseInt(route.query.sortOrder as any, 10) : undefined,
    //     sortField: route.query.sortField ? Number.parseInt(route.query.sortField as any, 10) : undefined,
    //     category: route.query.category,
    //     gameVersion: route.query.gameVersion ?? '',
    //   }),
    // },
    // {
    //   path: '/curseforge/:type/:id',
    //   component: CurseforgeProject,
    //   props: (route) => ({ type: route.path.split('/')[2], id: route.path.split('/')[3], from: route.query.from }),
    // },
    // {
    //   path: '/modrinth',
    //   component: Modrinth,
    //   props: (route) => ({
    //     query: route.query.query,
    //     gameVersion: route.query.gameVersion,
    //     license: route.query.license,
    //     category: route.query.category ? (typeof route.query.category === 'string' ? [route.query.category] : route.query.category) : [],
    //     modLoader: route.query.modLoader,
    //     environment: route.query.environment,
    //     sortBy: route.query.sortBy,
    //     projectType: route.query.projectType,
    //     page: Number.parseInt(route.query.page as any ?? '1', 10),
    //     from: route.query.from,
    //   }),
    // },
    // {
    //   path: '/modrinth/:id',
    //   component: ModrinthProject,
    //   props: (route) => ({ id: route.path.split('/')[2] }),
    // },
  ],
})
