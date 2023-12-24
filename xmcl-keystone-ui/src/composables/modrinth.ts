import { Category, SearchResultHit } from '@xmcl/modrinth'
import { InjectionKey, Ref, computed, reactive, toRefs, watch } from 'vue'

import { clientModrinthV2 } from '@/util/clients'
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
      clientModrinthV2.getGameVersionTags(),
      clientModrinthV2.getLicenseTags(),
      clientModrinthV2.getCategoryTags(),
      clientModrinthV2.getLoaderTags(),
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

// export function useModrinthSearch() {
//   return useSWRV(
//     computed(() => `/modrinth/search?query=${props.query}&limit=${data.pageSize}&offset=${(props.page - 1) * data.pageSize}&index=${sortBy.value}&facets=${facetsText.value}`),
//     () => clientModrinthV2.searchProjects({
//       query: props.query,
//       limit: data.pageSize,
//       offset: (props.page - 1) * data.pageSize,
//       index: sortBy.value,
//       facets: facetsText.value,
//     }), useOverrideSWRVConfig({ ttl: 30 * 1000 }))
// }

export function getFacatsText(
  gameVersion: string,
  license: string,
  category: string[],
  modLoader: string,
  projectType: string,
  environment: string,
) {
  const facets: string[][] = []
  if (gameVersion && gameVersion !== 'null') {
    facets.push([`versions:${gameVersion}`])
  }
  if (license) {
    facets.push([`license:${license}`])
  }
  if (modLoader) {
    facets.push([`categories:${modLoader}`])
  }
  if (category) {
    for (const cat of category) {
      facets.push([`categories:${cat}`])
    }
  }
  if (projectType) {
    facets.push([`project_type:${projectType}`])
  }
  if (environment) {
    if (environment === 'server') {
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
}

export function getModrinthSearchUrl(
  query: string,
  limit: number,
  offset: number,
  sortBy: string,
  facetsText: string | undefined,
) {
  return `/modrinth/search?query=${query}&limit=${limit}&offset=${(offset)}&index=${sortBy}&facets=${facetsText}`
}

export function useModrinth(props: ModrinthOptions) {
  const { t } = useI18n()
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
    pageSize: 10,
    pageCount: 0,
    pageSizeOptions: [5, 10, 15, 20],
  })

  const facetsText = computed(() => getFacatsText(props.gameVersion, props.license, props.category, props.modLoader, props.projectType, props.environment))
  const { data: searchData, isValidating: refreshing, error, mutate } = useSWRV(
    computed(() => getModrinthSearchUrl(props.query, data.pageSize, (props.page - 1) * data.pageSize, props.sortBy, facetsText.value)),
    () => clientModrinthV2.searchProjects({
      query: props.query,
      limit: data.pageSize,
      offset: (props.page - 1) * data.pageSize,
      index: props.sortBy,
      facets: facetsText.value,
    }), useOverrideSWRVConfig({ ttl: 30 * 1000 }))

  watch(searchData, (result) => {
    if (result) {
      data.pageCount = Math.floor(result.total_hits / data.pageSize) + 1
    }
  }, { immediate: true })

  const projects = computed(() => searchData.value?.hits || [])
  const debouncedRefresh = debounce(() => mutate(), 1000)
  const wrappedRefresh = () => {
    refreshing.value = true
    return debouncedRefresh()
  }

  watch(() => props.projectType, () => {
    props.category = []
  })

  watch(props, () => {
    wrappedRefresh()
  }, { deep: true })

  return {
    ...toRefs(data),
    projects,
    projectTypes,
    refresh: wrappedRefresh,
    refreshing,
    sortOptions,
    error,
  }
}
