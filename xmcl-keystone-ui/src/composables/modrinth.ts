import { Category, GameVersion, License } from '@xmcl/modrinth'
import { InjectionKey, Ref, computed, reactive, toRefs, watch } from 'vue'

import { clientModrinthV2 } from '@/util/clients'
import debounce from 'lodash.debounce'
import useSWRV from 'swrv'
import { kSWRVConfig, useOverrideSWRVConfig } from './swrvConfig'
import { MaybeRef, get } from '@vueuse/core'
import { formatKey } from '@/util/swrvGet'

export interface ModrinthOptions {
  query: string
  gameVersion: string
  license: string
  category: string[]
  modLoader: string
  environment: string
  sortBy: string | undefined
  projectType: string
  page: number
}

export const kModrinthTags: InjectionKey<ReturnType<typeof useModrinthTags>> = Symbol('ModrinthTags')

export function useModrinthTags() {
  const { data: gameVersions_, isValidating: isGameVersionValidating, error: errorGameVersions } = useSWRV('/modrinth/tags/gameVersions', () => clientModrinthV2.getGameVersionTags().then(markRaw), inject(kSWRVConfig))
  const { data: licenses_, isValidating: isLicenseValidating, error: errorLicenses } = useSWRV('/modrinth/tags/licenses', () => clientModrinthV2.getLicenseTags().then(markRaw), inject(kSWRVConfig))
  const { data: categories_, isValidating: isCategoryValidating, error: errorCategories } = useSWRV('/modrinth/tags/categories', () => clientModrinthV2.getCategoryTags().then(markRaw), inject(kSWRVConfig))
  const { data: modLoaders_, isValidating: isModLoaderValidating, error: errorModLoaders } = useSWRV('/modrinth/tags/modLoaders', () => clientModrinthV2.getLoaderTags().then(markRaw), inject(kSWRVConfig))

  const gameVersions = computed(() => gameVersions_.value || [])
  const licenses = computed(() => licenses_.value || [])
  // const categories = computed(() => data.value?.categories || [])
  const categories = computed(() => categories_.value || [])
  // const modLoaders = computed(() => data.value?.modLoaders || [])
  const modLoaders = computed(() => modLoaders_.value || [])
  // const environments = computed(() => data.value?.environments || [])
  const environments = computed(() => ['client', 'server'])

  const refreshing = computed(() => isGameVersionValidating.value || isLicenseValidating.value || isCategoryValidating.value || isModLoaderValidating.value)

  const error = computed(() => errorGameVersions.value || errorLicenses.value || errorCategories.value || errorModLoaders.value)

  return {
    errorGameVersions,
    errorLicenses,
    errorCategories,
    errorModLoaders,

    isGameVersionValidating,
    isLicenseValidating,
    isCategoryValidating,
    isModLoaderValidating,

    refreshing,
    error,
    gameVersions,
    licenses,
    categories,
    modLoaders,
    environments,
  }
}

export function getFacatsText(
  gameVersion: string,
  license: string,
  category: string[],
  modLoaders: string[],
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
  if (modLoaders.length > 0) {
    facets.push(modLoaders.map(v => `categories:${v}`))
  }
  if (category.length > 0) {
    facets.push(category.map(c => `categories:${c}`))
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
  sortBy: string | undefined,
  facetsText: string | undefined,
) {
  return `/modrinth/search?query=${query}&limit=${limit}&offset=${(offset)}&index=${sortBy || ''}&facets=${facetsText || ''}`
}

export function useModrinthSearchFunc(
  query: MaybeRef<string>,
  gameVersion: MaybeRef<string>,
  license: MaybeRef<string>,
  category: MaybeRef<string[]>,
  modLoader: MaybeRef<string[]>,
  environment: MaybeRef<string>,
  sortBy: MaybeRef<string | undefined>,
  projectType: MaybeRef<string>,
  pageSize: MaybeRef<number>,
) {
  async function search(index: number) {
    const facets = getFacatsText(get(gameVersion), get(license), get(category), get(modLoader), get(projectType), get(environment))
    return clientModrinthV2.searchProjects({
      query: get(query),
      limit: get(pageSize),
      offset: index,
      index: get(sortBy),
      facets,
    })
  }

  return search
}

export function useModrinth(
  query: MaybeRef<string>,
  gameVersion: MaybeRef<string>,
  license: MaybeRef<string>,
  category: MaybeRef<string[]>,
  modLoader: MaybeRef<string[]>,
  environment: MaybeRef<string>,
  sortBy: MaybeRef<string | undefined>,
  projectType: MaybeRef<string>,
  page: MaybeRef<number>,
  pageSize: MaybeRef<number>,
) {
  const search = useModrinthSearchFunc(
    query,
    gameVersion,
    license,
    category,
    modLoader,
    environment,
    sortBy,
    projectType,
    pageSize,
  )

  const { data: searchData, isValidating: refreshing, error, mutate } = useSWRV(
    computed(() => formatKey('/modrinth/search', {
      query,
      pageSize,
      page,
      sortBy,
      gameVersion,
      license,
      category,
      modLoader,
      environment,
      projectType,
    })),
    () => search((get(page) - 1) * get(pageSize)), useOverrideSWRVConfig({ ttl: 30 * 1000 }))

  const pages = computed(() => searchData.value ? Math.floor(searchData.value.total_hits / get(pageSize)) + 1 : 0)

  const projects = computed(() => searchData.value?.hits || [])
  const debouncedRefresh = debounce(() => mutate(), 1000)
  const refresh = () => {
    refreshing.value = true
    return debouncedRefresh()
  }

  watch([
    query,
    pageSize,
    page,
    sortBy,
    gameVersion,
    license,
    category,
    modLoader,
    environment,
    projectType,
  ], () => {
    refresh()
  }, { deep: true })

  return {
    pageCount: pages,
    projects,
    refresh,
    refreshing,
    error,
  }
}
