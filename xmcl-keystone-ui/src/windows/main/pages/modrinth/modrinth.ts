import { computed, reactive, toRefs, watch } from '@vue/composition-api'
import { ModResult } from '@xmcl/modrinth'
import { ModrinthServiceKey } from '@xmcl/runtime-api'
import { useI18n, useService } from '/@/hooks'
import { useRefreshable } from '/@/hooks/useRefreshable'
import debounce from 'lodash.debounce'

export function useModrinthCategories() {
}

export function useModrinth() {
  const { searchMods, getModVersion, getTags } = useService(ModrinthServiceKey)
  const { $t } = useI18n()
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
    query: '',
    gameVersions: [] as string[],
    gameVersion: '',
    licenses: [] as string[],
    license: '',
    categories: [] as string[],
    category: '',
    modLoaders: [] as string[],
    modLoader: '',
    environments: [] as string[],
    environment: '',
    sortBy: '',
    page: 1,
    pageSize: 10,
    pageCount: 0,
    pageSizeOptions: [5, 10, 15, 20],
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

  watch([refs.gameVersion, refs.license, refs.category, refs.environment, refs.modLoader, refs.pageSize, refs.page, refs.sortBy], () => {
    debouncedRefresh()
  })

  const { refresh, refreshing } = useRefreshable(async () => {
    const facets: string[][] = []
    if (data.gameVersion) {
      facets.push([`version:${data.gameVersion}`])
    }
    if (data.license) {
      facets.push([`license:${data.license}`])
    }
    if (data.modLoader) {
      facets.push([`categories:${data.modLoader}`])
    }
    if (data.category) {
      facets.push([`categories:${data.category}`])
    }
    if (data.environment) {
      if (data.environment === 'server') {
        facets.push(['client_side:optional', 'client_side:unsupported'], ['server_side:optional', 'server_side:required'])
      } else {
        facets.push(['client_side:optional', 'client_side:required'], ['server_side:optional', 'server_side:unsupported'])
      }
    }
    let facetsText = undefined as string | undefined
    if (facets.length > 0) {
      facetsText = '[' + facets.map(v => '[' + v.map(v => JSON.stringify(v)).join(',') + ']').join(',') + ']'
    }
    const result = await searchMods({ query: data.query, limit: data.pageSize, offset: (data.page - 1) * data.pageSize, index: data.sortBy, facets: facetsText })
    data.pageCount = Math.floor(result.total_hits / data.pageSize)
    data.mods = result.hits
  })

  const debouncedRefresh = debounce(refresh, 500)

  return { ...refs, refresh: debouncedRefresh, refreshing, refreshTag, refreshingTag, sortOptions }
}
