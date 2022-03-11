import { computed, reactive, toRefs, watch } from '@vue/composition-api'
import { ModResult } from '@xmcl/modrinth'
import { ModrinthServiceKey } from '@xmcl/runtime-api'
import { useI18n, useRouter, useService } from '/@/hooks'
import { useRefreshable } from '/@/hooks/useRefreshable'
import debounce from 'lodash.debounce'

export function useModrinthCategories() {
}

export interface ModrinthOptions {
  query: string
  gameVersion: string
  license: string
  category: string
  modLoader: string
  environment: string
  sortBy: string
  page: number
}

export function useModrinth(props: ModrinthOptions) {
  const { searchMods, getModVersion, getTags } = useService(ModrinthServiceKey)
  const { $t } = useI18n()
  const { replace } = useRouter()
  const sortOptions = computed(() => [{
    name: '',
    text: $t('modrinth.sort.relevance'),
  }, {
    name: 'downloads',
    text: $t('modrinth.sort.downloads'),
  }, {
    name: 'follows',
    text: $t('modrinth.sort.follows'),
  }, {
    name: 'newest',
    text: $t('modrinth.sort.newest'),
  }, {
    name: 'updated',
    text: $t('modrinth.sort.updated'),
  }])

  const data = reactive({
    mods: [] as ModResult[],
    gameVersions: [] as string[],
    licenses: [] as string[],
    categories: [] as string[],
    modLoaders: [] as string[],
    environments: [] as string[],
    pageSize: 10,
    pageCount: 0,
    pageSizeOptions: [5, 10, 15, 20],
  })

  const getQueryString = (options: ModrinthOptions) => Object.entries(options).map(([key, val]) => `${key}=${val}`).join('&')

  const query = computed({
    get() { return props.query },
    set(query: string) {
      if (query !== props.query) {
        replace(`/modrinth?${getQueryString({ ...props, query, page: 1 })}`)
      }
    },
  })

  const gameVersion = computed({
    get() { return props.gameVersion },
    set(gameVersion: string) {
      replace(`/modrinth?${getQueryString({ ...props, gameVersion, page: 1 })}`)
    },
  })
  const license = computed({
    get() { return props.license },
    set(license: string) {
      replace(`/modrinth?${getQueryString({ ...props, license, page: 1 })}`)
    },
  })
  const environment = computed({
    get() { return props.environment },
    set(environment: string) {
      replace(`/modrinth?${getQueryString({ ...props, environment, page: 1 })}`)
    },
  })
  const category = computed({
    get() { return props.category },
    set(category: string) {
      replace(`/modrinth?${getQueryString({ ...props, category, page: 1 })}`)
    },
  })
  const modLoader = computed({
    get() { return props.modLoader },
    set(modLoader: string) {
      replace(`/modrinth?${getQueryString({ ...props, modLoader, page: 1 })}`)
    },
  })
  const page = computed({
    get() { return props.page },
    set(page: number) {
      replace(`/modrinth?${getQueryString({ ...props, page })}`)
    },
  })
  const sortBy = computed({
    get() { return props.sortBy },
    set(sortBy: string) {
      replace(`/modrinth?${getQueryString({ ...props, sortBy, page: 1 })}`)
    },
  })

  const { refresh: refreshTag, refreshing: refreshingTag } = useRefreshable(async () => {
    const result = await getTags()
    data.gameVersions = result.gameVersions
    data.licenses = result.licenses
    data.categories = result.categories
    data.modLoaders = result.modLoaders
    data.environments = result.environments
  })

  const refs = toRefs(data)

  const { refresh, refreshing } = useRefreshable(async () => {
    const facets: string[][] = []
    if (gameVersion.value && gameVersion.value !== 'null') {
      facets.push([`version:${gameVersion.value}`])
    }
    if (license.value) {
      facets.push([`license:${license.value}`])
    }
    if (modLoader.value) {
      facets.push([`categories:${modLoader.value}`])
    }
    if (category.value) {
      facets.push([`categories:${category.value}`])
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
    const result = await searchMods({ query: props.query, limit: data.pageSize, offset: (props.page - 1) * data.pageSize, index: sortBy.value, facets: facetsText })
    data.pageCount = Math.floor(result.total_hits / data.pageSize)
    data.mods = result.hits
  })

  const debouncedRefresh = debounce(refresh)
  const wrappedRefresh = () => {
    refreshing.value = true
    return debouncedRefresh()
  }

  watch([query, gameVersion, license, category, environment, modLoader, refs.pageSize, page, sortBy], () => {
    wrappedRefresh()
  })

  return {
    ...refs,
    query,
    refresh: wrappedRefresh,
    refreshing,
    refreshTag,
    refreshingTag,
    sortOptions,
    gameVersion,
    license,
    environment,
    category,
    modLoader,
    page,
    sortBy,
  }
}
