import { Category, SearchResultHit } from '@xmcl/modrinth'
import { InjectionKey, Ref, computed, reactive, toRefs, watch } from 'vue'

import { client } from '@/util/modrinthClients'
import debounce from 'lodash.debounce'
import useSWRV from 'swrv'
import { kSWRVConfig, useOverrideSWRVConfig } from './swrvConfig'

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
  const { data, isValidating: refreshing, error } = useSWRV('/modrinth/tags', async () => {
    const [gameVersions, licenses, categories, modLoaders] = await Promise.all([
      client.getGameVersionTags(),
      client.getLicenseTags(),
      client.getCategoryTags(),
      client.getLoaderTags(),
    ])
    return {
      gameVersions,
      licenses,
      categories,
      modLoaders,
      environments: ['client', 'server'],
    }
  }, inject(kSWRVConfig))

  provide(ModrinthCategoriesKey, computed(() => data.value?.categories || []))

  const gameVersions = computed(() => data.value?.gameVersions || [])
  const licenses = computed(() => data.value?.licenses || [])
  const categories = computed(() => data.value?.categories || [])
  const modLoaders = computed(() => data.value?.modLoaders || [])
  const environments = computed(() => data.value?.environments || [])

  return {
    error,
    refreshing,
    gameVersions,
    licenses,
    categories,
    modLoaders,
    environments,
  }
}

export function useModrinth(props: ModrinthOptions) {
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
  }, {
    value: 'shader',
    text: t('modrinth.projectType.shader'),
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

  const facetsText = computed(() => {
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
    return facetsText
  })
  const { data: searchData, isValidating: refreshing, error, mutate } = useSWRV(
    computed(() => `/modrinth/search?query=${props.query}&limit=${data.pageSize}&offset=${(props.page - 1) * data.pageSize}&index=${sortBy.value}&facets=${facetsText.value}`),
    () => client.searchProjects({
      query: props.query,
      limit: data.pageSize,
      offset: (props.page - 1) * data.pageSize,
      index: sortBy.value,
      facets: facetsText.value,
    }), useOverrideSWRVConfig({ ttl: 30 * 1000 }))

  watch(searchData, (result) => {
    if (result) {
      data.pageCount = Math.floor(result.total_hits / data.pageSize) + 1
      data.projects = result.hits
    }
  })
  const debouncedRefresh = debounce(() => mutate(), 1000)
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
    error,
  }
}
