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
import ResourcePack from '@/views/ResourcePack.vue'
import ResourcePackActions from '@/views/ResourcePackActions.vue'
import ResourcePackExtension from '@/views/ResourcePackExtension.vue'
import Save from '@/views/Save.vue'
import SaveActions from '@/views/SaveActions.vue'
import SaveExtension from '@/views/SaveExtension.vue'
import Setting from '@/views/Setting.vue'
import ShaderPack from '@/views/ShaderPack.vue'
import ShaderPackActions from '@/views/ShaderPackActions.vue'
import ShaderPackExtension from '@/views/ShaderPackExtension.vue'
import Store from '@/views/Store.vue'
import StoreEntry from '@/views/StoreEntry.vue'
import StoreProjectCurseforge from '@/views/StoreProjectCurseforge.vue'
import StoreProjectFeedTheBeast from '@/views/StoreProjectFeedTheBeast.vue'
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
            actions: SaveActions,
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
          path: '/resourcepacks',
          components: {
            default: ResourcePack,
            extensions: ResourcePackExtension,
            actions: ResourcePackActions,
          },
        },
        {
          path: '/shaderpacks',
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
        {
          path: '/store/ftb/:id',
          component: StoreProjectFeedTheBeast,
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
      path: '/multiplayer',
      component: Multiplayer,
    },
  ],
})
