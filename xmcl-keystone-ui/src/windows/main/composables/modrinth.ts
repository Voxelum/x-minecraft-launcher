import { computed, InjectionKey, reactive, Ref, toRefs, watch } from 'vue'
import { Category, GameVersion, License, Loader, SearchResultHit } from '@xmcl/modrinth'
import { ModrinthServiceKey } from '@xmcl/runtime-api'

import { useService, useRefreshable } from '/@/composables'
import debounce from 'lodash.debounce'

export interface ModrinthOptions {
  query: string
  gameVersion: string
  license: string
  category: string[]
  modLoader: string
  environment: string
  sortBy: string
  projectType: string
  page: number
}

export const ModrinthCategoriesKey: InjectionKey<Ref<Category[]>> = Symbol('ModrinthCategoriesKey')

export function useModrinthTags() {
  const { getTags } = useService(ModrinthServiceKey)
  const data = reactive({
    gameVersions: [] as GameVersion[],
    licenses: [] as License[],
    categories: [] as Category[],
    modLoaders: [] as Loader[],
    environments: [] as string[],
  })

  const { refresh, refreshing } = useRefreshable(async () => {
    const result = await getTags()
    data.gameVersions = result.gameVersions
    data.licenses = result.licenses
    data.categories = result.categories
    data.modLoaders = result.modLoaders
    data.environments = result.environments
  })

  provide(ModrinthCategoriesKey, computed(() => data.categories))

  return {
    ...toRefs(data),
    refresh,
    refreshing,
  }
}

export function useModrinth(props: ModrinthOptions) {
  const { searchProjects } = useService(ModrinthServiceKey)
  const { t } = useI18n()
  const { replace } = useRouter()
  const router = useRouter()
  const projectTypes = computed(() => [{
    value: 'mod',
    text: t('modrinth.projectType.mod'),
  }, {
    value: 'modpack',
    text: t('modrinth.projectType.modpack'),
  }, {
    value: 'resourcepack',
    text: t('modrinth.projectType.resourcePack'),
  }])
  const sortOptions = computed(() => [{
    name: '',
    text: t('modrinth.sort.relevance'),
  }, {
    name: 'downloads',
    text: t('modrinth.sort.downloads'),
  }, {
    name: 'follows',
    text: t('modrinth.sort.follows'),
  }, {
    name: 'newest',
    text: t('modrinth.sort.newest'),
  }, {
    name: 'updated',
    text: t('modrinth.sort.updated'),
  }])

  const data = reactive({
    projects: [] as SearchResultHit[],
    pageSize: 10,
    pageCount: 0,
    pageSizeOptions: [5, 10, 15, 20],
  })

  const getQueryString = (options: ModrinthOptions) => Object.entries(options).map(([key, val]) => `${key}=${val}`).join('&')

  const query = computed({
    get() { return props.query },
    set(query: string) {
      if (query !== props.query) {
        replace({ query: { ...router.currentRoute.query, query, page: '1' } })
      }
    },
  })

  const projectType = computed({
    get() { return props.projectType },
    set(projectType: string) {
      replace({ query: { ...router.currentRoute.query, projectType, page: '1' } })
    },
  })
  const gameVersion = computed({
    get() { return props.gameVersion },
    set(gameVersion: string) {
      replace({ query: { ...router.currentRoute.query, gameVersion, page: '1' } })
    },
  })
  const license = computed({
    get() { return props.license },
    set(license: string) {
      replace({ query: { ...router.currentRoute.query, license, page: '1' } })
    },
  })
  const environment = computed({
    get() { return props.environment },
    set(environment: string) {
      replace({ query: { ...router.currentRoute.query, environment, page: '1' } })
    },
  })
  const category = computed({
    get() { return props.category },
    set(category: string[]) {
      replace({ query: { ...router.currentRoute.query, category, page: '1' } })
    },
  })
  const modLoader = computed({
    get() { return props.modLoader },
    set(modLoader: string) {
      replace({ query: { ...router.currentRoute.query, modLoader, page: '1' } })
    },
  })
  const page = computed({
    get() { return props.page },
    set(page: number) {
      replace({ query: { ...router.currentRoute.query, page: page.toString() } })
    },
  })
  const sortBy = computed({
    get() { return props.sortBy },
    set(sortBy: string) {
      replace({ query: { ...router.currentRoute.query, sortBy, page: '1' } })
    },
  })

  const refs = toRefs(data)

  const { refresh, refreshing } = useRefreshable(async () => {
    const facets: string[][] = []
    if (gameVersion.value && gameVersion.value !== 'null') {
      facets.push([`versions:${gameVersion.value}`])
    }
    if (license.value) {
      facets.push([`license:${license.value}`])
    }
    if (modLoader.value) {
      facets.push([`categories:${modLoader.value}`])
    }
    if (category.value) {
      for (const cat of category.value) {
        facets.push([`categories:${cat}`])
      }
    }
    if (projectType.value) {
      facets.push([`project_type:${projectType.value}`])
    }
    if (environment.value) {
      if (environment.value === 'server') {
        facets.push(['client_side:optional', 'client_side:unsupported'], ['server_side:optional', 'server_side:required'])
      } else {
        facets.push(['client_side:optional', 'client_side:required'], ['server_side:optional', 'server_side:unsupported'])
      }
    }
    let facetsText = undefined as string | undefined
    if (facets.length > 0) {
      facetsText = '[' + facets.map(v => '[' + v.map(v => JSON.stringify(v)).join(',') + ']').join(',') + ']'
    }
    const result = await searchProjects({ query: props.query, limit: data.pageSize, offset: (props.page - 1) * data.pageSize, index: sortBy.value, facets: facetsText })
    data.pageCount = Math.floor(result.total_hits / data.pageSize)
    data.projects = result.hits
  })

  const debouncedRefresh = debounce(refresh)
  const wrappedRefresh = () => {
    refreshing.value = true
    return debouncedRefresh()
  }

  watch(projectType, () => {
    category.value = []
  })

  watch([query, gameVersion, license, category, environment, modLoader, refs.pageSize, page, sortBy, projectType], () => {
    wrappedRefresh()
  })

  return {
    ...refs,
    projectTypes,
    query,
    refresh: wrappedRefresh,
    refreshing,
    sortOptions,
    projectType,
    gameVersion,
    license,
    environment,
    category,
    modLoader,
    page,
    sortBy,
  }
}
