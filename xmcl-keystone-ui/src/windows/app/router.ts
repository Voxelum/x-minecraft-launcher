import Curseforge from '@/views/Curseforge.vue'
import CurseforgeProject from '@/views/CurseforgeProject.vue'
import Router from 'vue-router'
import Modrinth from '@/views/Modrinth.vue'
import ModrinthProject from '@/views/ModrinthProject.vue'
import Vue from 'vue'

Vue.use(Router)

export const router = new Router({
  mode: 'hash',
  routes: [
    {
      path: '/curseforge/:type',
      component: Curseforge,
      props: (route) => ({
        from: route.query.from,
        type: route.path.split('/')[2],
        page: Number.parseInt(route.query.page as any ?? '1', 10),
        keyword: route.query.keyword,
        modLoaderType: route.query.modLoaderType ? Number.parseInt(route.query.modLoaderType as any, 10) : undefined,
        sortOrder: route.query.sortOrder ? Number.parseInt(route.query.sortOrder as any, 10) : undefined,
        sortField: route.query.sortField ? Number.parseInt(route.query.sortField as any, 10) : undefined,
        category: route.query.category,
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
        category: route.query.category ? (typeof route.query.category === 'string' ? [route.query.category] : route.query.category) : [],
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
