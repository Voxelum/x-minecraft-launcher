<template>
  <div
    ref="container"
    class="w-full overflow-auto"
    :class="{ 'pinned': pinned }"
  >
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="isModrinthSearching || ftbLoading || isCurseforgeSearching"
      height="3"
      :indeterminate="true"
    />
    <div
      class="z-8 sticky top-1 mt-4 w-full px-4 grid"
      style="grid-template-columns: 35% 25% 10% 30%;"
    >
      <v-text-field
        id="search-text-field"
        ref="searchTextField"
        v-model="keyword"
        background-color="secondary"
        color="green"
        class="rounded-xl search-field pr-4"
        append-icon="search"
        solo
        hide-details
        clearable
        :placeholder="t('modrinth.searchText')"
        @click:clear="query = ''"
        @keydown.enter="query = keyword"
        @click:append="query = keyword"
      />
    </div>
    <div class="main px-3">
      <div
        id="popular-modpacks"
        class="section"
      >
        <v-subheader>
          <v-icon left>
            local_fire_department
          </v-icon>
          {{ t('store.popular') }}
        </v-subheader>

        <v-carousel
          :interval="7000"
          class="min-h-[410px] max-w-[950px] flex-grow self-center"
          :cycle="true"
          :show-arrows="true"
          hide-delimiter-background
          height="410"
        >
          <v-carousel-item
            v-for="(g, i) in popularItems"
            :key="i"
          >
            <StoreGallery
              :gallery="g"
              @enter="enter(g.type, g.id)"
            />
          </v-carousel-item>
        </v-carousel>
      </div>
      <div class="section">
        <v-subheader>
          <v-icon
            left
            size="20"
          >
            update
          </v-icon>
          {{ t('store.recentUpdated') }}
        </v-subheader>

        <GalleryGrid
          :items="recentUpdatedItems"
          @enter="enter($event.type, $event.id)"
        />
      </div>
      <div class="section">
        <v-subheader>
          <v-icon left>
            $vuetify.icons.minecraft
          </v-icon>
          {{ t('store.latestMinecraft') }}
        </v-subheader>

        <GalleryList
          :items="recentMinecraftItems"
          @enter="enter($event.type, $event.id)"
        />
      </div>

      <v-subheader ref="exploreHeader">
        <v-icon left>
          explore
        </v-icon>
        {{ t('store.explore') }}
      </v-subheader>

      <div class="content">
        <div
          v-if="!searchError && items.length > 0"
          id="search-result"
          class="relative flex flex-col gap-3 lg:px-2.5"
        >
          <div
            class="hover:(scale-100 opacity-100) absolute bottom-3 z-10 w-full scale-90 transform opacity-60 transition"
          >
            <v-pagination
              v-model="page"
              :length="pageCount"
              color="success"
              :disabled="isModrinthSearching || isCurseforgeSearching"
              :total-visible="12"
            />
          </div>
          <StoreExploreCard
            v-for="mod in items"
            :key="mod.id"
            v-ripple
            :disabled="false"
            :value="mod"
            class="cursor-pointer"
            @mouseenter.native="onMouseEnter($event, mod)"
            @mouseleave.native="onMouseLeave(mod)"
            @click="enter(mod.type, mod.id)"
          />

          <div class="min-h-14 w-full p-1" />
        </div>
        <Hint
          v-if="items.length === 0"
          icon="mood_bad"
          :size="80"
          :text="`No search result for ${query}`"
        />
      </div>
      <div class="category overflow-auto">
        <StoreExploreCategories
          id="search-category"
          :display="hovered?.gallery"
          :groups="groups"
          :loading="refreshingTag"
          :selected="selected"
          :error="tagError"
          @select="onSelect"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { CategoryChipProps } from '@/components/CategoryChip.vue'
import GalleryGrid from '@/components/GalleryGrid.vue'
import GalleryList from '@/components/GalleryList.vue'
import Hint from '@/components/Hint.vue'
import StoreExploreCard, { ExploreProject } from '@/components/StoreExploreCard.vue'
import StoreExploreCategories, { Category, ExploreCategoryGroup } from '@/components/StoreExploreCategories.vue'
import StoreGallery, { GameGallery } from '@/components/StoreGallery.vue'
import { CurseforgeBuiltinClassId, kCurseforgeCategories, useCurseforge, useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { useDateString } from '@/composables/date'
import { getFeedTheBeastProjectModel, useFeedTheBeast } from '@/composables/ftb'
import { useMarketSort } from '@/composables/marketSort'
import { getFacatsText, kModrinthTags, useModrinth } from '@/composables/modrinth'
import { useQuery, useQueryNumber, useQueryStringArray } from '@/composables/query'
import { useSortByItems } from '@/composables/sortBy'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useTextFieldBehavior } from '@/composables/textfieldBehavior'
import { useTutorial } from '@/composables/tutorial'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCursforgeModLoadersFromString } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { getSWRV } from '@/util/swrvGet'
import { useEventListener, useFocus } from '@vueuse/core'
import { Mod, ModsSearchSortField } from '@xmcl/curseforge'
import { SearchResultHit } from '@xmcl/modrinth'
import { DriveStep } from 'driver.js'
import useSWRV from 'swrv'

const { push } = useRouter()

function ensureQuery(query: Record<string, string | (string | null)[] | null | undefined>) {
  query.page = '1'
  scrollToView()
  if (!query.query) {
    if (query.sort === '0') {
      query.sort = '1'
    }
  }
}

const query = useQuery('query', ensureQuery)
const gameVersion = useQuery('gameVersion', ensureQuery)
const modLoaders = useQueryStringArray('modLoaders', ensureQuery)
const sort = useQuery('sort', (q) => { q.page = '1' })
const page = useQueryNumber('page', 1)

const keyword = ref(query)
const { t } = useI18n()
const { getDateString } = useDateString()
const tCategory = useCurseforgeCategoryI18n()

function merge<T>(first: T[], second: T[]) {
  const result: T[] = []
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    const m = first[i]
    const c = second[i]
    if (m) result.push(m)
    if (c) result.push(c)
  }
  return result
}

// Popular list
const { data: modrinthResult, error, isValidating } = useSWRV('/modrinth/featured', async () => {
  const result = await clientModrinthV2.searchProjects({
    index: 'follows',
    limit: 5,
    facets: getFacatsText('', '', [], [], 'modpack', ''),
  })
  return result.hits
}, inject(kSWRVConfig))
const { data: curseforgeResult, error: curseforgeError, isValidating: curseforgeValidating } = useSWRV('/curseforge/featured', async () => {
  const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.Featured, classId: 4471, pageSize: 5 })
  return result.data
}, inject(kSWRVConfig))
const popularItems = computed(() => {
  function getGameGalleryFromModrinth(hits: SearchResultHit[]) {
    return hits.map((hit) => {
      const images = hit.gallery.map(g => [g, g]) as [string, string][]
      if (hit.icon_url) {
        images.push([hit.icon_url, hit.icon_url])
      }
      const game: GameGallery = {
        id: hit.project_id,
        title: hit.title,
        images,
        type: 'modrinth',
        developer: hit?.author ?? '',
        minecraft: hit?.versions ?? [],
        categories: hit.categories.map(c => t(`modrinth.categories.${c}`, c)),
      }
      return game
    })
  }
  function getGameGalleryFromCurseforge(mods: Mod[]) {
    return mods.map((p) => {
      const images = p.screenshots.map(g => [g.thumbnailUrl, g.url]) as [string, string][]
      if (p.logo) {
        images.push([p.logo.thumbnailUrl, p.logo.url])
      }
      const game: GameGallery = {
        id: p.id.toString(),
        title: p.name,
        images,
        type: 'curseforge',
        developer: p.authors[0].name,
        minecraft: p.latestFilesIndexes.map(f => f.gameVersion),
        categories: p.categories.map(c => tCategory(c.name)),
      }
      return game
    })
  }

  const modrinth = getGameGalleryFromModrinth(modrinthResult.value ?? [])
  const curseforge = getGameGalleryFromCurseforge(curseforgeResult.value ?? [])

  return merge(modrinth, curseforge)
})

// Recent updated
const { data: modrinthRecent, error: errorRecent, isValidating: isValidatingRecent } = useSWRV('/modrinth/recent_update', async () => {
  const result = await clientModrinthV2.searchProjects({
    index: 'updated',
    limit: 24,
    facets: getFacatsText('', '', [], [], 'modpack', ''),
  })
  return result.hits
}, inject(kSWRVConfig))
const { data: curseforgeRecent } = useSWRV('/curseforge/recent_update', async () => {
  const result = await clientCurseforgeV1.searchMods({
    sortField: ModsSearchSortField.LastUpdated,
    classId: 4471,
    pageSize: 30,
  })
  return result.data
}, inject(kSWRVConfig))
const recentUpdatedItems = computed(() => {
  const recent = modrinthRecent.value || []
  const cfRecent = curseforgeRecent.value || []

  return merge(
    recent.map((r) => ({
      title: r.title,
      id: r.project_id,
      type: 'modrinth',
      logo: r.icon_url,
      description: r.description,
      updatedAt: r.date_modified,
      follows: r.follows,
      downloads: r.downloads,
      categories: r.categories.map(c => t(`modrinth.categories.${c}`, c)),
    })),
    cfRecent.map((r) => ({
      id: r.id.toString(),
      type: 'curseforge',
      title: r.name,
      logo: r.logo.thumbnailUrl,
      description: r.summary,
      updatedAt: r.dateModified,
      follows: r.downloadCount,
      downloads: r.downloadCount,
      categories: r.categories.map(c => tCategory(c.name)),
    })),
  )
})

// Latest minecraft
const latestModrinth = computed(() => gameVersions.value.filter(v => v.major)[0].version)
const { data: modrinthRecentMinecraft } = useSWRV('/modrinth/recent_version', async () => {
  const result = await clientModrinthV2.searchProjects({
    index: 'newest',
    limit: 30,
    facets: getFacatsText(latestModrinth.value, '', [], [], 'modpack', ''),
  })
  return result.hits
}, inject(kSWRVConfig))
const { data: curseforgeRecentMinecraft } = useSWRV('/curseforge/recent_version', async () => {
  const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.GameVersion, classId: 4471, pageSize: 30 })
  return result.data
}, inject(kSWRVConfig))
const recentMinecraftItems = computed(() => {
  const modrinths = modrinthRecentMinecraft.value || []
  const curseforges = curseforgeRecentMinecraft.value || []

  return merge(
    modrinths.map((r) => ({
      title: r.title,
      type: 'modrinth',
      id: r.project_id,
      image: r.icon_url || r.gallery[0],
      gameVersion: latestModrinth.value,
      categories: r.categories.map(c => t(`modrinth.categories.${c}`, c)),
    })),
    curseforges.map((r) => ({
      id: r.id.toString(),
      type: 'curseforge',
      title: r.name,
      image: r.logo.thumbnailUrl,
      gameVersion: r.latestFilesIndexes[0]?.gameVersion,
      categories: r.categories.map(c => tCategory(c.name)),
    })),
  )
})

// FTB
const { refreshing: ftbLoading, currentKeyword, data: ftbData } = useFeedTheBeast(reactive({ keyword: query }))
const ftbItems = ref([] as ExploreProject[])
const config = inject(kSWRVConfig)
watch(ftbData, async (packs) => {
  if (!packs) {
    ftbItems.value = []
    return
  }
  if (!('packs' in packs)) {
    ftbItems.value = []
    return
  }
  ftbItems.value = await Promise.all(packs.packs.map(async (p) => {
    const data = await getSWRV(getFeedTheBeastProjectModel(ref(p)), config)
    const result: ExploreProject = {
      id: p.toString(),
      type: 'ftb',
      title: data?.name ?? '',
      icon_url: data?.art.find(v => v.type === 'square')?.url ?? '',
      description: data?.synopsis || '',
      author: data?.authors[0].name ?? '',
      labels: [
        { icon: 'file_download', text: getExpectedSize(data?.installs ?? 0, '') },
        { icon: 'event', text: getDateString((data?.released ?? 0) * 1000) },
        { icon: 'edit', text: getDateString((data?.refreshed ?? 0) * 1000) },
        { icon: 'local_offer', text: data?.plays.toString() ?? '0' },
      ],
      tags: data?.tags.map(t => ({ text: t.name })) ?? [],
      gallery: data?.art.map(a => a.url) ?? [],
    }
    return result
  }))
}, { immediate: true })

// Routing
const enter = (type: string, id: string) => {
  push(`/store/${type}/${id}`)
}

const sortBy = useSortByItems()
const { refreshing: refreshingTag, categories: modrinthCategories, modLoaders: modrinthModloaders, gameVersions, error: tagError } = injection(kModrinthTags)

const { modrinthSort, curseforgeSort } = useMarketSort(sort)

const _modrinthCategories = useQueryStringArray('modrinthCategories', ensureQuery)
// Modrinth
const {
  error: searchError,
  refreshing: isModrinthSearching, projects, pageCount,
} = useModrinth(
  query,
  gameVersion,
  '',
  _modrinthCategories,
  modLoaders,
  '',
  modrinthSort,
  'modpack',
  page,
  10,
)

// Curseforge
const curseforgeCategory = useQueryNumber('curseforgeCategory', undefined as undefined | number, ensureQuery)
const { projects: curseforgeProjects, isValidating: isCurseforgeSearching } = useCurseforge(
  CurseforgeBuiltinClassId.modpack,
  query,
  page,
  computed(() => getCursforgeModLoadersFromString(modLoaders.value)),
  curseforgeCategory,
  curseforgeSort,
  gameVersion,
)

const items = computed(() => {
  const modrinths = projects.value.map((p) => {
    const mapped: ExploreProject = {
      id: p.project_id,
      type: 'modrinth',
      title: p.title,
      icon_url: p.icon_url,
      description: p.description,
      author: p.author,
      labels: [
        { icon: 'file_download', text: getExpectedSize(p.downloads, '') },
        { icon: 'event', text: getDateString(p.date_created) },
        { icon: 'edit', text: getDateString(p.date_modified) },
        { icon: 'local_offer', text: p.versions[p.versions.length - 1] },
      ],
      tags: p.categories.map(c => ({ icon: modrinthCategories.value.find(cat => cat.name === c)?.icon, text: t(`modrinth.categories.${c}`, c) })),
      gallery: p.gallery,
    }
    return mapped
  })
  const curseforges = curseforgeProjects.value.map((p) => {
    const existed = new Set<number>()
    const tags = p.categories.map(c => {
      if (existed.has(c.id)) return undefined
      existed.add(c.id)
      return { icon: c.iconUrl, text: tCategory(c.name) } as CategoryChipProps
    }).filter((v): v is CategoryChipProps => v !== undefined)
    const mapped: ExploreProject = {
      id: p.id.toString(),
      type: 'curseforge',
      title: p.name,
      icon_url: p.logo.thumbnailUrl,
      description: p.summary,
      author: p.authors[0].name,
      labels: [
        { icon: 'file_download', text: getExpectedSize(p.downloadCount, '') },
        { icon: 'event', text: getDateString(p.dateModified) },
        { icon: 'edit', text: getDateString(p.dateModified) },
        { icon: 'local_offer', text: p.latestFilesIndexes[0].gameVersion },
      ],
      tags,
      gallery: p.screenshots.map(s => s.thumbnailUrl),
    }
    return mapped
  })

  if (curseforgeCategory.value && _modrinthCategories.value.length === 0) {
    return curseforges
  }
  if (_modrinthCategories.value.length > 0 && curseforgeCategory.value === undefined) {
    return modrinths
  }

  return merge(merge(modrinths, ftbItems.value), curseforges)
})

// Scroll to the search result
const container = ref<any>(null)
const exploreHeader = ref<any | null>(null)
function scrollToView() {
  const component = exploreHeader.value
  const el = component?.$el as HTMLElement | undefined
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}
watch(items, () => {
  if (query.value || gameVersion.value || modLoaders.value.length > 0 || _modrinthCategories.value.length > 0 || curseforgeCategory.value) {
    // Scroll to the element
    const component = exploreHeader.value
    const el = component?.$el as HTMLElement | undefined
    if (el) {
      // check if el in viewport
      const rect = el.getBoundingClientRect()
      if (rect.y > 300) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }
})

watch(page, () => {
  scrollToView()
})

// Hovered project
const hovered = ref(undefined as ExploreProject | undefined)
const onMouseEnter = (event: MouseEvent, proj: ExploreProject) => {
  if (proj.gallery.length > 0) {
    hovered.value = proj
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
let timeout: any
const onMouseLeave = (e: any) => {
  timeout = setTimeout(() => {
    hovered.value = undefined
    timeout = undefined
  }, 300)
}

// Categories
const { categories: curseforgeCategories } = injection(kCurseforgeCategories)
const groups = computed(() => {
  const modrinthCatResult: Category[] = modrinthCategories.value.filter(v => v.project_type === 'modpack').map(c => ({
    id: c.name,
    text: t(`modrinth.categories.${c.name}`, c.name),
    iconHTML: c.icon,
  }))
  const curseforgeCatResult: Category[] = (curseforgeCategories.value?.filter(c => c.parentCategoryId === 4471) || []).map(c => ({
    id: c.id.toString(),
    text: tCategory(c.name),
    icon: c.iconUrl,
  }))

  const result: ExploreCategoryGroup[] = [{
    id: 'sortBy',
    text: t('modrinth.sort.title'),
    type: 'buttons',
    categories: sortBy.value.map(s => ({
      id: s.value,
      text: s.text,
      icon: s.icon,
    })),
  }, {
    id: 'gameVersions',
    text: t('modrinth.gameVersions.name'),
    type: 'menu',
    categories: gameVersions.value.map(v => ({
      id: v.version,
      text: v.version,
    })),
  }, {
    id: 'modloaders',
    text: t('modrinth.modLoaders.name'),
    type: 'checkbox',
    categories: modrinthModloaders.value.filter(l => l.supported_project_types.includes('modpack')).map(l => ({
      id: l.name,
      text: l.name[0].toUpperCase() + l.name.slice(1),
      iconHTML: l.icon,
    })),
  }, {
    id: 'modrinthCategories',
    text: t('modrinth.categories.categories') + ' (Modrinth)',
    type: 'checkbox',
    categories: modrinthCatResult,
  }, {
    id: 'curseforgeCategories',
    text: t('curseforge.category') + ' (Curseforge)',
    type: 'checkbox',
    categories: curseforgeCatResult,
  }]

  return result
})

const selected = computed(() => {
  const result: string[] = []

  result.push(..._modrinthCategories.value)
  if (typeof curseforgeCategory.value === 'number') {
    result.push(curseforgeCategory.value.toString())
  }
  if (gameVersion.value) {
    result.push(gameVersion.value)
  }
  result.push(...modLoaders.value)
  if (sort.value) {
    result.push(sort.value)
  }

  return result
})

// Category select
const onSelect = ({ group, category }: { group: string; category: string }) => {
  if (group === 'modrinthCategories') {
    const index = _modrinthCategories.value.indexOf(category)
    if (index === -1) {
      _modrinthCategories.value = [..._modrinthCategories.value, category]
    } else {
      _modrinthCategories.value = _modrinthCategories.value.filter((_, i) => i !== index)
    }
  } else if (group === 'curseforgeCategories') {
    const cat = curseforgeCategories.value?.find(c => c.id.toString() === category)
    if (cat) {
      if (curseforgeCategory.value === cat.id) {
        curseforgeCategory.value = undefined
      } else {
        curseforgeCategory.value = cat.id
      }
    }
  } else if (group === 'modloaders') {
    if (category) {
      const index = modLoaders.value.indexOf(category)
      if (index === -1) {
        modLoaders.value = [...modLoaders.value, category]
      } else {
        modLoaders.value = modLoaders.value.filter((_, i) => i !== index)
      }
    }
  } else if (group === 'gameVersions') {
    gameVersion.value = category
  } else if (group === 'sortBy') {
    sort.value = category === sort.value ? '' : category
  }
}

// Search field
const searchTextField = ref(undefined as any | undefined)
const searchTextEl = computed(() => searchTextField.value?.$el as HTMLElement | undefined)
const { focused } = useFocus(searchTextEl)
useEventListener(document, 'keydown', useTextFieldBehavior(searchTextField, focused), { capture: true })

// Category sticky
const pinned = ref(false)
onMounted(() => {
  const el = document.querySelector('#search-category')
  if (el) {
    const observer = new IntersectionObserver(
      ([e]) => {
        pinned.value = e.isIntersecting
      },
      { threshold: [1] },
    )
    observer.observe(el)
  }
})

// Tutorial
useTutorial(computed(() => {
  const steps: DriveStep[] = [
    { element: '#popular-modpacks', popover: { align: 'center', title: t('store.popular'), description: t('tutorial.storePoupularModpackDescription') } },
    { element: '#search-text-field', popover: { title: t('curseforge.search'), description: t('tutorial.storeSearchDescription') } },
    {
      element: '#search-result',
      popover: {
        side: 'right',
        align: 'start',
        title: t('modInstall.search'),
        description: t('tutorial.storeSearchResultDescription'),
      },
    },
    { element: '#search-category', popover: { side: 'left', title: t('curseforge.category'), description: t('tutorial.storeSearchCategoryDescription') } },
  ]
  return steps
}))
</script>
<style scoped>
.main {
  display: grid;
  grid-template-columns: 35% 25% 10% 30%;
  /* grid-template-columns: repeat(4, minmax(0, 1fr)); */
  grid-template-rows: repeat(auto-fit);
}

.section {
  grid-row: auto;
  grid-column: 1 / 5;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.section .v-subheader {
  margin-top: 16px;
  margin-bottom: 16px;
}

.category {
  grid-column: 4 / 5;
  grid-row: auto;
  position: sticky;
  top: 10px;
  left: 0;
  align-self: start;
}

.category>.v-card {
  max-height: calc(100vh - 50px);
}

.content {
  grid-column: 1 / 4;
  grid-row: auto;
}

.search-field {
  grid-column-start: 2;
  grid-column-end: 4;
  transition: all;
  transition-duration: 200ms;
}

.pinned .search-field {
  grid-column-start: 1;
  grid-column-end: 4;
}

@media screen and (max-width: 1024px) {
  .content {
    grid-column: 1 / 3;
  }

  .category {
    grid-column: 3 / 5;
  }

  .pinned .search-field {
    grid-column-start: 1;
    grid-column-end: 3;
  }
}

.v-subheader {
  z-index: 4;
}
</style>
