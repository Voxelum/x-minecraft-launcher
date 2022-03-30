import { computed, onMounted, reactive, Ref, toRefs, watch } from '@vue/composition-api'
import { AddonInfo } from '@xmcl/curseforge'
import { CurseForgeServiceKey } from '@xmcl/runtime-api'
import { useRouter, useService } from '/@/hooks'

export interface CurseforgeProps {
  type: string
  page: number
  keyword: string
  category: string
  sort: string
  gameVersion: string
}

/**
 * Hook to return the controller of curseforge preview page. Navigating the curseforge projects.
 */
export function useCurseforge(props: CurseforgeProps) {
  const router = useRouter()
  const { searchProjects } = useService(CurseForgeServiceKey)
  const pageSize = 10

  const currentType = computed({
    get() { return props.type },
    set(v: string) {
      router.push(`/curseforge/${v}`)
    },
  })
  const currentSectionId = computed(() => {
    switch (props.type) {
      case 'modpacks':
        return 4471
      case 'texture-packs':
        return 12
      case 'worlds':
        return 17
      case 'customization':
        return 4546
      case 'mc-mods':
      default:
        return 6
    }
  })
  const currentPage = computed({
    get() { return props.page },
    set(v: number) {
      router.replace({ query: { ...router.currentRoute.query, page: v.toString() } })
    },
  })
  const currentCategory = computed({
    get() { return props.category },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, category: v } })
    },
  })
  const currentSort = computed({
    get() { return props.sort },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, sort: v } })
    },
  })
  const currentKeyword = computed({
    get() { return props.keyword },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, keyword: v } })
    },
  })
  const currentVersion = computed({
    get() { return props.gameVersion },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, gameVersion: v } })
    },
  })
  const categoryId = computed({
    get() { return Number.isInteger(currentCategory.value) ? Number.parseInt(currentCategory.value, 10) : undefined },
    set(v: number | undefined) {
      if (v) {
        currentCategory.value = v.toString()
      } else {
        currentCategory.value = ''
      }
    },
  })

  const data = reactive({
    pages: 5,
    projects: [] as AddonInfo[],
    loading: false,
  })
  const index = computed(() => (currentPage.value - 1) * pageSize)
  async function refresh() {
    data.loading = true
    try {
      const projects = await searchProjects({
        pageSize,
        index: index.value,
        sectionId: currentSectionId.value,
        sort: Number.isInteger(currentSort.value) ? Number.parseInt(currentSort.value, 10) : undefined,
        gameVersion: currentVersion.value,
        categoryId: categoryId.value,
        searchFilter: currentKeyword.value,
      })
      if (currentPage.value > data.pages / 2) {
        data.pages += 5
      }
      projects.forEach(p => Object.freeze(p))
      projects.forEach(p => Object.freeze(p.categories))
      data.projects = Object.freeze(projects) as any
    } finally {
      data.loading = false
    }
  }
  watch([currentPage, currentSort, currentVersion, currentKeyword, currentCategory, currentType], () => {
    refresh()
  })
  onMounted(() => { refresh() })
  return {
    ...toRefs(data),
    categoryId,
    currentSort,
    currentVersion,
    currentKeyword,
    currentPage,
    currentCategory,
    currentType,
    refresh,
  }
}
