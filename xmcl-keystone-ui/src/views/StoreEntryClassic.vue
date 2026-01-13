<template>
  <div ref="container" class="w-full overflow-auto" :class="{ 'pinned': pinned }">
    <v-progress-linear class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="isSearching" height="3" :indeterminate="true" />
    <div class="z-8 sticky top-1 mt-4 w-full px-4 flex items-center justify-between gap-4">
      <div class="flex-1 max-w-2xl">
        <v-text-field id="search-text-field" ref="searchTextField" v-model="keyword" color="green"
          class="rounded-xl search-field" append-icon="search" solo hide-details clearable
          :placeholder="t('modrinth.searchText')" @click:clear="query = ''" @keydown.enter="query = keyword"
          @click:append="query = keyword" />
      </div>
      <v-btn-toggle v-model="marketLayout" mandatory rounded class="bg-surface">
        <v-btn value="classic" small>
          <v-icon left>view_list</v-icon>
          Classic
        </v-btn>
        <v-btn value="modern" small>
          <v-icon left>apps</v-icon>
          Modern
        </v-btn>
      </v-btn-toggle>
    </div>
    <div class="main px-3">
      <div id="popular-modpacks" class="section">
        <v-subheader>
          <v-icon left>
            local_fire_department
          </v-icon>
          {{ t('store.popular') }}
        </v-subheader>

        <v-carousel :interval="7000" class="min-h-[410px] max-w-[950px] flex-grow self-center" :cycle="true"
          :show-arrows="true" hide-delimiter-background height="410">
          <v-carousel-item v-for="(g, i) in popularItems" :key="i">
            <StoreGallery :gallery="g" @enter="enter(g.type, g.id)" />
          </v-carousel-item>
        </v-carousel>
      </div>
      <div class="section">
        <v-subheader>
          <v-icon left size="20">
            update
          </v-icon>
          {{ t('store.recentUpdated') }}
        </v-subheader>

        <GalleryGrid :items="recentUpdatedItems" @enter="enter($event.type, $event.id)" />
      </div>
      <div class="section">
        <v-subheader>
          <v-icon left>
            $vuetify.icons.minecraft
          </v-icon>
          {{ t('store.latestMinecraft') }}
        </v-subheader>

        <GalleryList :items="recentMinecraftItems" @enter="enter($event.type, $event.id)" />
      </div>

      <v-subheader ref="exploreHeader">
        <v-icon left>
          explore
        </v-icon>
        {{ t('store.explore') }}
      </v-subheader>

      <div class="content">
        <div v-if="!searchError && items.length > 0" id="search-result" class="relative flex flex-col gap-3 lg:px-2.5">
          <div
            class="hover:(scale-100 opacity-100) absolute bottom-3 z-10 w-full scale-90 transform opacity-60 transition">
            <v-pagination v-model="page" :length="pageCount" color="success"
              :disabled="isSearching" :total-visible="12" />
          </div>
          <StoreExploreCard v-for="mod in items" :key="mod.id" v-ripple :disabled="false" :value="mod"
            class="cursor-pointer" @mouseenter.native="onMouseEnter($event, mod)" @mouseleave.native="onMouseLeave(mod)"
            @click="enter(mod.type, mod.id)" />

          <div class="min-h-14 w-full p-1" />
        </div>
        <Hint v-if="items.length === 0" icon="mood_bad" :size="80" :text="`No search result for ${query}`" />
      </div>
      <div class="category overflow-auto">
        <StoreExploreCategories id="search-category" :display="hovered?.gallery" :groups="groups"
          :loading="refreshingTag" :selected="selected" :error="tagError" @select="onSelect" />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import GalleryGrid from '@/components/GalleryGrid.vue'
import GalleryList from '@/components/GalleryList.vue'
import Hint from '@/components/Hint.vue'
import StoreExploreCard, { ExploreProject } from '@/components/StoreExploreCard.vue'
import StoreExploreCategories, { Category, ExploreCategoryGroup } from '@/components/StoreExploreCategories.vue'
import StoreGallery from '@/components/StoreGallery.vue'
import { kCurseforgeCategories, useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { useMarketLayout } from '@/composables/marketLayout'
import { kModrinthTags } from '@/composables/modrinth'
import { useQuery, useQueryNumber, useQueryStringArray } from '@/composables/query'
import { useSortByItems } from '@/composables/sortBy'
import { useTextFieldBehavior } from '@/composables/textfieldBehavior'
import { useTutorial } from '@/composables/tutorial'
import { usePopularItems } from '@/composables/usePopularItems'
import { useRecentMinecraftItems } from '@/composables/useRecentMinecraftItems'
import { useRecentUpdatedItems } from '@/composables/useRecentUpdatedItems'
import { useSearchedItems } from '@/composables/useSearchedItems'
import { injection } from '@/util/inject'
import { useEventListener, useFocus } from '@vueuse/core'
import { DriveStep } from 'driver.js'
const marketLayout = inject('layout', useMarketLayout())

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
const sources = useQueryStringArray('sources', ensureQuery)
const _modrinthCategories = useQueryStringArray('modrinthCategories', ensureQuery)
const curseforgeCategory = useQueryNumber('curseforgeCategory', undefined as undefined | number, ensureQuery)
const pageSize = 10

const keyword = ref(query)
const { t } = useI18n()
const tCategory = useCurseforgeCategoryI18n()

// Shared mapping store for all sections
const galleryMappings = shallowRef<Record<string, { name: string; description: string }>>({})

// Use the new popular items composable
const { popularItems } = usePopularItems(galleryMappings)
const { recentUpdatedItems } = useRecentUpdatedItems(galleryMappings)
const { recentMinecraftItems } = useRecentMinecraftItems(galleryMappings)

// Routing
const enter = (type: string, id: string) => {
  push(`/store/${type}/${id}`)
}

const sortBy = useSortByItems()

// Use the new searched items composable
const {
  items,
  isSearching,
  searchError,
  pageCount,
} = useSearchedItems({
  query,
  gameVersion,
  modLoaders,
  sort,
  page,
  sources,
  modrinthCategories: _modrinthCategories,
  curseforgeCategory,
  pageSize,
  tCategory,
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
const { refreshing: refreshingTag, categories: modrinthCategories, modLoaders: modrinthModloaders, gameVersions, error: tagError } = injection(kModrinthTags)
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
    id: 'modFilter',
    text: t('modFilter.source', 'Source'),
    type: 'checkbox',
    categories: [
      { id: 'modrinth', text: 'Modrinth', icon: 'cloud' },
      { id: 'curseforge', text: 'CurseForge', icon: 'public' },
      { id: 'ftb', text: 'FTB', icon: 'apps' },
    ],
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
  result.push(...sources.value)

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
  } else if (group === 'modFilter') {
    const index = sources.value.indexOf(category)
    if (index === -1) {
      sources.value = [...sources.value, category]
    } else {
      sources.value = sources.value.filter((_, i) => i !== index)
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
