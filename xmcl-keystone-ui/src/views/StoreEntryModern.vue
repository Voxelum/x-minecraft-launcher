<template>
  <div class="store-modern h-full w-full overflow-hidden flex flex-col bg-background">
    <v-progress-linear class="absolute left-0 top-0 z-10 m-0 p-0"
        :active="loading" height="3" :indeterminate="true" />
    <div class="flex-none py-6 pb-3 grid grid-cols-8 px-3 gap-1 lg:(grid-cols-12 gap-6 px-8) w-full z-10 sticky top-0">
      <div class="hidden lg:(col-span-3 block)">
        <v-btn value="modern" @click="marketLayout = 'classic'">
          <v-icon left>apps</v-icon>
          Classic
        </v-btn>
      </div>
      <div class="col-span-4 lg:(col-span-5) max-w-2xl relative group">
         <v-text-field
           v-model="keyword"
           solo
           flat
           hide-details
           rounded
           height="52"
           placeholder="Search ModPacks..."
           prepend-inner-icon="search"
           class="elevated-search text-lg"
           background-color="surface"
         >
          <template #append>
            <v-slide-x-transition>
               <v-icon v-if="keyword" @click="query = ''; keyword = ''" class="cursor-pointer">close</v-icon>
            </v-slide-x-transition>
          </template>
         </v-text-field>
      </div>
      <div class="col-span-4">
        <v-pagination v-if="pageCount > 1" v-model="page" :length="pageCount" circle color="primary"></v-pagination>
      </div>
    </div>
    <div class="flex-1 flex overflow-y-auto flex-col lg:(overflow-hidden flex-row)">
      <!--#region Sidebar Filters -->
      <div class="w-auto lg:(w-88 overflow-y-auto pb-20) flex-none px-4 pt-4 flex flex-col gap-6 custom-scrollbar ">
        <div class="grid grid-cols-3 lg:(flex flex-col) gap-6">
          <!-- Sources -->
          <div class="filter-group">
            <h3 class="filter-title">
              Sources
            </h3>
            <div class="flex gap-2">
              <div 
                v-for="source in sourcesList" 
                :key="source.id"
                class="relative hover:text-warmgray-2 flex-1 flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent"
                :class="sources.includes(source.id) ? 'text-primary' : 'bg-surface text-gray-400'"
                @click="toggleSource(source.id)"
              >
                  <component :is="source.component" class="w-6 h-6 fill-current" />
                  <span class="text-xs font-bold mt-2">{{ source.text }}</span>
                  <div 
                    class="absolute flex items-center justify-center w-16 h-16 transition-opacity duration-400"
                    :style="{ opacity: sources.includes(source.id) ? 1 : 0 }"
                  >
                     <v-icon color="red" size="60">close</v-icon>
                  </div>
              </div>
            </div>
          </div>
          <!-- Sort -->
          <div class="filter-group">
            <h3 class="filter-title"> {{ t('modrinth.sort.title') }} </h3>
            <v-autocomplete
              v-model="sort"
              :items="sortBy"
              item-text="text"
              item-value="value"
              outlined
              dense
              rounded
              clearable
              hide-details
              :placeholder="t('modrinth.sort.title')"
              class="rounded-xl"
            ></v-autocomplete>
          </div>
          <!-- Game Version -->
          <div class="filter-group">
            <h3 class="filter-title">{{ t('modrinth.gameVersions.name') }}</h3>
            <v-autocomplete
              v-model="gameVersion"
              :items="gameVersions"
              item-text="version"
              item-value="version"
              outlined
              dense
              rounded
              clearable
              hide-details
              :placeholder="t('modrinth.gameVersions.name')"
              class="rounded-xl"
            ></v-autocomplete>
          </div>
        </div>
        
        <!-- ModLoaders -->
        <FilterCard
          :title="t('modrinth.modLoaders.name')"
          :items="catModLoaders.map(loader => ({
            id: loader.name,
            text: loader.name[0].toUpperCase() + loader.name.slice(1),
            iconHTML: loader.icon
          }))"
          :selected="modLoaders"
          :selected-count="modLoaders.length"
          @toggle="toggleModLoader"
          @clear="modLoaders = []"
        />
        <!-- Modrinth Categories -->
        <FilterCard
          :title="`${t('curseforge.category')} (Modrinth)`"
          :items="modrinthCategoriesDisplay"
          :selected="_modrinthCategories"
          :selected-count="_modrinthCategories.length"
          @toggle="toggleModrinthCategory"
          @clear="_modrinthCategories = []"
        />
        <!-- CurseForge Categories -->
        <FilterCard
          :title="`${t('curseforge.category')} (CurseForge)`"
          :items="curseforgeCategoriesDisplay"
          :selected="curseforgeCategory ? [curseforgeCategory.toString()] : []"
          :selected-count="curseforgeCategory ? 1 : 0"
          @toggle="toggleCurseforgeCategory"
          @clear="curseforgeCategory = undefined"
        />
      </div>

      <!-- Main Content -->
      <div class="flex-1 lg:(overflow-y-auto) p-8 custom-scrollbar relative" ref="container">
        <!-- Featured Carousel -->
        <div v-if="!keyword && selectedCount === 0" class="mb-12">
           <h2 class="text-2xl font-bold mb-6 flex items-center gap-3">
             <v-icon color="orange" large>local_fire_department</v-icon> Trending
           </h2>
           <v-carousel
             cycle 
             height="400" 
             hide-delimiter-background
             show-arrows-on-hover 
             class="rounded-3xl overflow-hidden"
             interval="6000"
           >
             <v-carousel-item v-for="(g, i) in popularItems" :key="i" src="">
                <StoreGallery :gallery="g" @enter="enter(g.type, g.id)" />
             </v-carousel-item>
           </v-carousel>
        </div>

        <!-- Grid -->
        <div class="min-h-screen">
          <div class="flex items-end justify-between mb-6 gap-2">
            <div>
              <h2 class="text-2xl font-bold text-white">Discover</h2>
              <p class="text-gray-400 text-sm mt-1 whitespace-nowrap">Found {{ items.length }} modpacks</p>
            </div>
            <!-- Active Filters -->
            <div v-if="hasFilters" class="flex justify-end items-center gap-2">
              <div class="flex gap-2 flex-wrap items-center">
                <v-chip
                  v-for="tag in activeTags"
                  :key="`${tag.type}-${tag.id}`"
                  small
                  outlined
                  close
                  @click:close="removeTag(tag)"
                  >
                  {{ tag.text }}
                </v-chip>
              </div>
              <v-btn v-if="hasFilters" outlined plain color="red" @click="clearAllFilters" small>
                <v-icon small left>clear</v-icon>
                Clear All
              </v-btn>
            </div>
          </div>
          <div v-if="items.length === 0" class="flex flex-col justify-center items-center h-96 text-center opacity-50">
            <v-icon size="96" color="grey lighten-1">mood_bad</v-icon>
            <h3 class="text-2xl font-bold mt-4">No ModPacks Found</h3>
            <p class="text-gray-400 mt-2">Try adjusting your filters or search query.</p>
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20">
            <StoreExploreCardModern
              v-for="mod in items" :key="mod.id"
              :value="mod"
              @click="enter(mod.type, mod.id)"
            />
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import CurseforgeIcon from '@/components/CurseforgeIcon.vue'
import FilterCard from '@/components/FilterCard.vue'
import FTBIcon from '@/components/FTBIcon.vue'
import ModrinthIcon from '@/components/ModrinthIcon.vue'
import StoreExploreCardModern from '@/components/StoreExploreCardModern.vue'
import StoreGallery from '@/components/StoreGallery.vue'
import { kCurseforgeCategories, useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { useMarketLayout } from '@/composables/marketLayout'
import { kModrinthTags } from '@/composables/modrinth'
import { useQuery, useQueryNumber, useQueryStringArray } from '@/composables/query'
import { useSortByItems } from '@/composables/sortBy'
import { usePopularItems } from '@/composables/usePopularItems'
import { useSearchedItems } from '@/composables/useSearchedItems'
import { injection } from '@/util/inject'

const { push } = useRouter()
const { t } = useI18n()
const marketLayout = inject('layout', useMarketLayout())

// --- Query State ---
function ensureQuery(query: Record<string, string | (string | null)[] | null | undefined>) {
  query.page = '1'
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
const keyword = ref(query)
const _modrinthCategories = useQueryStringArray('modrinthCategories', ensureQuery)
const curseforgeCategory = useQueryNumber('curseforgeCategory', undefined as undefined | number, ensureQuery)
const pageSize = 20 // Bigger page size for modern grid

// --- Data Fetching Logic (Mirrored from StoreEntryClassic) ---
const tCategory = useCurseforgeCategoryI18n()
const galleryMappings = ref<Record<string, { name: string; description: string }>>({})

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

const {
  popularItems
} = usePopularItems(galleryMappings)

// Search Logic
const sortBy = useSortByItems()

const loading = computed(() => isSearching.value)

// Mappings for results
const mappings = ref<Record<string, { name: string; description: string }>>({})
const { refreshing: refreshingTag, categories: modrinthCategories, modLoaders: modrinthModloaders, gameVersions } = injection(kModrinthTags)
const { categories: curseforgeCategories } = injection(kCurseforgeCategories)
const catModLoaders = computed(() => modrinthModloaders.value.filter(v => v.supported_project_types.includes('modpack')))

const enter = (type: string, id: string) => {
  push(`/store/${type}/${id}`)
}

// --- UI Logic for Filters ---
const expandedPanels = ref([1]) // Open Modloaders and Modrinth categories by default
const sourcesList = [
  { id: 'modrinth', text: 'Modrinth', component: ModrinthIcon },
  { id: 'curseforge', text: 'CurseForge', component: CurseforgeIcon },
  { id: 'ftb', text: 'FTB', component: FTBIcon },
]

function toggleSource(id: string) {
  if (sources.value.includes(id)) {
    sources.value = sources.value.filter(s => s !== id)
  } else {
    sources.value = [...sources.value, id]
  }
}

// Categories Display
const modrinthCategoriesDisplay = computed(() => {
  return modrinthCategories.value.filter(v => v.project_type === 'modpack').map(c => ({
    id: c.name,
    text: t(`modrinth.categories.${c.name}`, c.name),
    iconHTML: c.icon,
  }))
})

function toggleModLoader(name: string) {
  if (modLoaders.value.includes(name)) {
    modLoaders.value = modLoaders.value.filter(n => n !== name)
  } else {
    modLoaders.value = [...modLoaders.value, name]
  }
}

// CurseForge Categories Display
const curseforgeCategoriesDisplay = computed(() => {
  return (curseforgeCategories.value?.filter(c => c.parentCategoryId === 4471) || []).map(c => ({
    id: c.id.toString(),
    text: tCategory(c.name),
    icon: c.iconUrl,
  }))
})

function toggleModrinthCategory(id: string) {
  if (_modrinthCategories.value.includes(id)) {
    _modrinthCategories.value = _modrinthCategories.value.filter(c => c !== id)
  } else {
    _modrinthCategories.value = [..._modrinthCategories.value, id]
  }
}

function toggleCurseforgeCategory(id: string | number) {
  id = Number(id)
  if (curseforgeCategory.value === id) {
    curseforgeCategory.value = undefined
  } else {
    curseforgeCategory.value = id
  }
}

// Active Filter Chips
const activeTags = computed(() => {
  const tags: { id: string, text: string, type: 'source'|'version'|'sort'|'loader'|'category' }[] = []
  
  sources.value.forEach(s => tags.push({ id: s, text: sourcesList.find(x => x.id === s)?.text || s, type: 'source' }))
  if (gameVersion.value) tags.push({ id: gameVersion.value, text: gameVersion.value, type: 'version' })
  modLoaders.value.forEach(l => tags.push({ id: l, text: l, type: 'loader' }))
  _modrinthCategories.value.forEach(c => tags.push({ id: c, text: modrinthCategoriesDisplay.value.find(x => x.id === c)?.text || c, type: 'category' }))
  if (curseforgeCategory.value) {
     const name = curseforgeCategoriesDisplay.value.find(x => x.id === curseforgeCategory.value?.toString())?.text
     tags.push({ id: curseforgeCategory.value.toString(), text: name || 'Category', type: 'category' })
  }
  
  return tags
})

const selectedCount = computed(() => activeTags.value.length)

function removeTag(tag: any) {
  if (tag.type === 'source') toggleSource(tag.id)
  if (tag.type === 'version') gameVersion.value = ''
  if (tag.type === 'loader') modLoaders.value = modLoaders.value.filter(l => l !== tag.id)
  if (tag.type === 'category') {
    if (_modrinthCategories.value.includes(tag.id)) toggleModrinthCategory(tag.id)
    else toggleCurseforgeCategory(Number(tag.id))
  }
}

function clearAllFilters() {
  sources.value = []
  gameVersion.value = ''
  modLoaders.value = []
  _modrinthCategories.value = []
  curseforgeCategory.value = undefined
}

const hasFilters = computed(() => selectedCount.value > 0 || !!keyword.value)
</script>

<style scoped>
.store-modern {
  /* Premium Dark Mode Feeling */
  user-select: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
}

/* Elevated Search Input */
.elevated-search :deep(.v-input__slot) {
  box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.elevated-search.v-input--is-focused :deep(.v-input__slot) {
  box-shadow: 0 8px 30px rgba(var(--v-theme-primary), 0.2) !important;
  transform: translateY(-1px);
}

.filter-title {
  @apply font-bold mb-3 text-xs uppercase text-gray-300 tracking-wider ml-1;
}

.filter-group {
  @apply mb-2;
}
</style>
