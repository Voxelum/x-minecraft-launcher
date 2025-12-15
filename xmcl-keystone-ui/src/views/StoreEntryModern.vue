<template>
  <div class="store-modern h-full w-full overflow-hidden flex flex-col bg-background">
    <!-- Header -->
    <div class="flex-none px-8 py-6 flex items-center justify-between gap-6 z-10 bg-opacity-70 backdrop-blur-md sticky top-0 border-b border-white/5">
      <div class="flex flex-col">
         <h1 class="text-3xl font-extrabold bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
           Store
         </h1>
      </div>
      
      <div class="flex-1 max-w-2xl relative group">
         <div class="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition duration-500"></div>
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

      <div class="flex items-center gap-3">
        <!-- Toggle Layout or Simple Settings could go here -->
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar Filters -->
      <div class="w-80 flex-none overflow-y-auto px-4 py-6 flex flex-col gap-6 custom-scrollbar pb-20">
        
        <!-- Active Filters -->
        <div v-if="selectedCount > 0" class="bg-surface rounded-2xl p-4 shadow-sm border border-white/5">
           <div class="flex items-center justify-between mb-2">
             <h3 class="font-bold text-sm uppercase text-gray-500 tracking-wider">Active Filters</h3>
             <v-btn x-small text color="error" @click="clearAllFilters">Clear All</v-btn>
           </div>
           <div class="flex flex-wrap gap-2">
             <v-chip v-for="tag in activeTags" :key="tag.id" close small @click:close="removeTag(tag)">
                {{ tag.text }}
             </v-chip>
           </div>
        </div>

        <!-- Sources -->
        <div class="filter-group">
          <h3 class="filter-title">Sources</h3>
          <div class="flex gap-2">
             <div 
               v-for="source in sourcesList" 
               :key="source.id"
               class="source-chip flex-1 flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent"
               :class="sources.includes(source.id) ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-surface hover:bg-surface-variant text-gray-400'"
               @click="toggleSource(source.id)"
             >
                <component :is="source.component" class="w-6 h-6 fill-current" />
                <span class="text-xs font-bold mt-2">{{ source.text }}</span>
             </div>
          </div>
        </div>

        <!-- Sort -->
        <div class="filter-group">
           <h3 class="filter-title">Sort By</h3>
           <v-select
            v-model="sort"
            :items="sortBy"
            item-text="text"
            item-value="value"
            outlined
            dense
            rounded
            hide-details
            background-color="surface"
            class="rounded-xl"
          ></v-select>
        </div>

        <!-- Game Version -->
        <div class="filter-group">
          <h3 class="filter-title">Game Version</h3>
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
            background-color="surface"
            label="Any Version"
            class="rounded-xl"
          ></v-autocomplete>
        </div>

        <!-- Categories (Collapsed) -->
        <v-expansion-panels flat tile class="bg-transparent gap-2 accordion-filters" multiple v-model="expandedPanels">
          <!-- ModLoaders -->
          <v-expansion-panel class="rounded-xl overflow-hidden bg-surface mb-2 border border-white/5">
            <v-expansion-panel-header class="font-bold text-sm uppercase text-gray-500">Mod Loaders</v-expansion-panel-header>
            <v-expansion-panel-content>
              <div class="flex flex-col gap-1 pt-2">
                <v-checkbox 
                  v-for="loader in modrinthModloaders" 
                  :key="loader.name" 
                  v-model="modLoaders" 
                  :value="loader.name" 
                  :label="loader.name" 
                  hide-details 
                  dense
                  class="mt-0 pt-0"
                ></v-checkbox>
              </div>
            </v-expansion-panel-content>
          </v-expansion-panel>

          <!-- Modrinth Categories -->
          <v-expansion-panel class="rounded-xl overflow-hidden bg-surface mb-2 border border-white/5">
             <v-expansion-panel-header class="font-bold text-sm uppercase text-gray-500">Categories (Modrinth)</v-expansion-panel-header>
             <v-expansion-panel-content>
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <div 
                    v-for="cat in modrinthCategoriesDisplay" 
                    :key="cat.id"
                    class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition hover:bg-white/5"
                    :class="_modrinthCategories.includes(cat.id) ? 'bg-primary/20 text-primary' : 'text-gray-400'"
                    @click="toggleModrinthCategory(cat.id)"
                  >
                     <div v-html="cat.iconHTML" class="w-5 h-5 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"></div>
                     <span class="text-xs font-medium truncate">{{ cat.text }}</span>
                  </div>
                </div>
             </v-expansion-panel-content>
          </v-expansion-panel>

          <!-- CurseForge Categories -->
          <v-expansion-panel class="rounded-xl overflow-hidden bg-surface border border-white/5">
             <v-expansion-panel-header class="font-bold text-sm uppercase text-gray-500">Categories (CurseForge)</v-expansion-panel-header>
             <v-expansion-panel-content>
                <div class="grid grid-cols-2 gap-2 pt-2">
                   <div 
                    v-for="cat in curseforgeCategoriesDisplay" 
                    :key="cat.id"
                    class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition hover:bg-white/5"
                    :class="curseforgeCategory === Number(cat.id) ? 'bg-primary/20 text-primary' : 'text-gray-400'"
                    @click="toggleCurseforgeCategory(Number(cat.id))"
                  >
                     <img :src="cat.icon" class="w-5 h-5 object-contain" />
                     <span class="text-xs font-medium truncate">{{ cat.text }}</span>
                  </div>
                </div>
             </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>

      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto p-8 custom-scrollbar relative" ref="container">
        
        <!-- Featured Carousel -->
        <div v-if="!keyword && !hasFilters && sources.length === 3" class="mb-12">
           <h2 class="text-2xl font-bold mb-6 flex items-center gap-3">
             <v-icon color="orange" large>local_fire_department</v-icon> Trending
           </h2>
           <v-carousel 
             cycle 
             height="400" 
             hide-delimiter-background 
             show-arrows-on-hover 
             class="rounded-3xl shadow-2xl overflow-hidden"
             interval="6000"
           >
             <v-carousel-item v-for="(g, i) in popularItems" :key="i" src="">
                <StoreGallery :gallery="g" @enter="enter(g.type, g.id)" />
             </v-carousel-item>
           </v-carousel>
        </div>

        <!-- Grid -->
        <div class="min-h-screen">
          <div class="flex items-end justify-between mb-6">
             <div>
               <h2 class="text-2xl font-bold text-white">Discover</h2>
               <p class="text-gray-400 text-sm mt-1">Found {{ items.length }} modpacks</p>
             </div>
          </div>

           <div v-if="loading" class="flex justify-center items-center h-96">
              <v-progress-circular indeterminate color="primary" size="64" width="6"></v-progress-circular>
           </div>
           
           <div v-else-if="items.length === 0" class="flex flex-col justify-center items-center h-96 text-center opacity-50">
              <v-icon size="96" color="grey lighten-1">mood_bad</v-icon>
              <h3 class="text-2xl font-bold mt-4">No ModPacks Found</h3>
              <p class="text-gray-400 mt-2">Try adjusting your filters or search query.</p>
           </div>
           
           <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20">
              <div 
                v-for="mod in items" :key="mod.id" 
                class="group relative bg-surface rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-2 border border-white/5 flex flex-col h-full cursor-pointer"
                @click="enter(mod.type, mod.id)"
              >
                 <!-- Image Area -->
                 <div class="aspect-[16/9] relative overflow-hidden bg-black/20">
                    <img 
                      :src="mod.gallery[0] || mod.icon_url" 
                      class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      loading="lazy" 
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                    
                    <div class="absolute top-3 right-3 flex gap-2">
                       <v-chip x-small color="black" class="bg-opacity-60 backdrop-blur-md font-bold uppercase tracking-wider text-[10px]">
                         {{ mod.type }}
                       </v-chip>
                    </div>

                    <div class="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 flex justify-between items-center">
                       <span class="text-xs font-bold text-white bg-primary px-2 py-1 rounded-md shadow-lg">INSTALL</span>
                    </div>
                 </div>

                 <!-- Content Area -->
                 <div class="p-4 flex flex-col flex-1 gap-2">
                    <div class="flex items-start gap-3">
                       <img :src="mod.icon_url" class="w-10 h-10 rounded-lg object-cover bg-surface-variant shadow-sm border border-white/10" />
                       <div class="overflow-hidden">
                          <h3 class="font-bold text-base leading-tight truncate text-white group-hover:text-primary transition-colors" :title="mod.title">
                            {{ mod.title }}
                          </h3>
                          <p class="text-xs text-gray-500 mt-0.5 truncate">{{ mod.author }}</p>
                       </div>
                    </div>
                    
                    <p class="text-xs text-gray-400 line-clamp-2 h-8 leading-relaxed">{{ mod.description }}</p>
                    
                    <div class="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                       <div class="flex items-center gap-1.5" title="Downloads">
                          <v-icon x-small color="grey">file_download</v-icon>
                          {{ mod.labels.find(l => l.icon === 'file_download')?.text }}
                       </div>
                       <div class="flex items-center gap-1.5" title="Last Updated">
                          <v-icon x-small color="grey">event</v-icon>
                          {{ mod.labels.find(l => l.icon === 'event')?.text }}
                       </div>
                       <div v-if="mod.labels.find(l => l.icon === 'local_offer')" class="flex items-center gap-1.5" title="Version">
                          <v-chip x-small outlined color="grey" class="px-1.5">
                             {{ mod.labels.find(l => l.icon === 'local_offer')?.text }}
                          </v-chip>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
           
           <!-- Pagination -->
            <div class="flex justify-center mt-8 pb-12" v-if="pageCount > 1">
               <v-pagination v-model="page" :length="pageCount" total-visible="7" circle color="primary"></v-pagination>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import StoreGallery, { GameGallery } from '@/components/StoreGallery.vue'
import ModrinthIcon from '@/components/ModrinthIcon.vue'
import CurseforgeIcon from '@/components/CurseforgeIcon.vue'
import FTBIcon from '@/components/FTBIcon.vue'
import { CurseforgeBuiltinClassId, kCurseforgeCategories, useCurseforge, useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { useDateString } from '@/composables/date'
import { getFeedTheBeastProjectModel, useFeedTheBeast } from '@/composables/ftb'
import { useMarketSort } from '@/composables/marketSort'
import { getFacatsText, kModrinthTags, useModrinth } from '@/composables/modrinth'
import { useQuery, useQueryNumber, useQueryStringArray } from '@/composables/query'
import { useSortByItems } from '@/composables/sortBy'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useService } from '@/composables/service'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCursforgeModLoadersFromString } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { mergeSorted } from '@/util/sort'
import { getSWRV } from '@/util/swrvGet'
import { Mod, ModsSearchSortField } from '@xmcl/curseforge'
import { SearchResultHit } from '@xmcl/modrinth'
import { ProjectMappingServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { ExploreProject } from '@/components/StoreExploreCard.vue'

const { push } = useRouter()
const { t } = useI18n()

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

const pageSize = 20 // Bigger page size for modern grid

// --- Data Fetching Logic (Mirrored from StoreEntryClassic) ---
const tCategory = useCurseforgeCategoryI18n()
const { lookupBatch } = useService(ProjectMappingServiceKey)
const galleryMappings = ref<Record<string, { name: string; description: string }>>({})
const { data: modrinthResult } = useSWRV('/modrinth/featured', async () => {
  const result = await clientModrinthV2.searchProjects({ index: 'follows', limit: 5, facets: getFacatsText('', '', [], [], 'modpack', '') })
  return result.hits
}, inject(kSWRVConfig))
const { data: curseforgeResult } = useSWRV('/curseforge/featured', async () => {
  const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.Featured, classId: 4471, pageSize: 5 })
  return result.data
}, inject(kSWRVConfig))

// Mappings watcher
watch([modrinthResult, curseforgeResult], async ([modrinthItems, cfItems]) => {
  const modrinthIds = (modrinthItems || []).map(p => p.project_id)
  const curseforgeIds = (cfItems || []).map(p => p.id)
  const result = await lookupBatch(modrinthIds, curseforgeIds)
  const newMappings: Record<string, { name: string; description: string }> = {}
  for (const mapping of result) {
    if (mapping.modrinthId) newMappings[`modrinth:${mapping.modrinthId}`] = { name: mapping.name, description: mapping.description }
    if (mapping.curseforgeId) newMappings[`curseforge:${mapping.curseforgeId}`] = { name: mapping.name, description: mapping.description }
  }
  galleryMappings.value = { ...galleryMappings.value, ...newMappings }
})

// Popular Items
const popularItems = computed(() => {
  function getGameGalleryFromModrinth(hits: SearchResultHit[]) {
    return hits.map((hit) => {
      const mapping = galleryMappings.value[`modrinth:${hit.project_id}`]
      const images = hit.gallery.map(g => [g, g]) as [string, string][]
      if (hit.icon_url) images.push([hit.icon_url, hit.icon_url])
      return {
        id: hit.project_id, title: hit.title, images, type: 'modrinth', developer: hit?.author ?? '', minecraft: hit?.versions ?? [], categories: hit.categories.map(c => t(`modrinth.categories.${c}`, c)), localizedTitle: mapping?.name,
      } as GameGallery
    })
  }
  function getGameGalleryFromCurseforge(mods: Mod[]) {
    return mods.map((p) => {
      const mapping = galleryMappings.value[`curseforge:${p.id}`]
      const images = p.screenshots.map(g => [g?.thumbnailUrl ?? '', g?.url ?? '']) as [string, string][]
      if (p.logo) images.push([p.logo?.thumbnailUrl ?? '', p.logo?.url ?? ''])
      return {
        id: p.id.toString(), title: p.name, images, type: 'curseforge', developer: p.authors[0]?.name ?? '', minecraft: p.latestFilesIndexes.map(f => f.gameVersion), categories: p.categories.map(c => tCategory(c.name)), localizedTitle: mapping?.name,
      } as GameGallery
    })
  }
  return mergeSorted(getGameGalleryFromModrinth(modrinthResult.value ?? []), getGameGalleryFromCurseforge(curseforgeResult.value ?? []))
})

// Search Logic
const sortBy = useSortByItems()
const { modrinthSort, curseforgeSort } = useMarketSort(sort)
const _modrinthCategories = useQueryStringArray('modrinthCategories', ensureQuery)
const curseforgeCategory = useQueryNumber('curseforgeCategory', undefined as undefined | number, ensureQuery)
const { refreshing: isModrinthSearching, projects, pageCount, } = useModrinth(query, gameVersion, '', _modrinthCategories, modLoaders, '', modrinthSort, 'modpack', page, pageSize)
const { projects: curseforgeProjects, isValidating: isCurseforgeSearching } = useCurseforge(
  CurseforgeBuiltinClassId.modpack, query, page, computed(() => getCursforgeModLoadersFromString(modLoaders.value)), curseforgeCategory, curseforgeSort, gameVersion, pageSize
)

const loading = computed(() => isModrinthSearching.value || isCurseforgeSearching.value)

// FTB
const { data: ftbData } = useFeedTheBeast(reactive({ keyword: query }))
const ftbItems = ref([] as ExploreProject[])
const config = inject(kSWRVConfig)
watch([ftbData, page], async ([packs, page]) => {
  if (!packs || !('packs' in packs)) { ftbItems.value = []; return }
  const offset = (page - 1) * pageSize
  const result = await Promise.all(packs.packs.slice(offset, offset + pageSize).map(async (p) => {
    const data = await getSWRV(getFeedTheBeastProjectModel(ref(p)), config)
    return {
       id: p.toString(), type: 'ftb', title: data?.name ?? '', icon_url: data?.art.find(v => v.type === 'square')?.url ?? '', description: data?.synopsis || '', author: data?.authors[0]?.name ?? '', labels: [], tags: [], gallery: []
    } as ExploreProject
  }))
  ftbItems.value = result
}, { immediate: true })

// Mappings for results
const mappings = ref<Record<string, { name: string; description: string }>>({})
const { getDateString } = useDateString()
const { refreshing: refreshingTag, categories: modrinthCategories, modLoaders: modrinthModloaders, gameVersions } = injection(kModrinthTags)
const { categories: curseforgeCategories } = injection(kCurseforgeCategories)

// Merged Items
const items = computed(() => {
  const modrinths = projects.value.map((p) => {
    const mapping = mappings.value[`modrinth:${p.project_id}`]
    return {
      id: p.project_id, type: 'modrinth', title: p.title, icon_url: p.icon_url, description: p.description, author: p.author,
      labels: [{ icon: 'file_download', text: getExpectedSize(p.downloads, ''), id: '' }, { icon: 'event', text: getDateString(p.date_created), id: '' }],
      tags: [], gallery: p.gallery, localizedTitle: mapping?.name, localizedDescription: mapping?.description,
    } as ExploreProject
  })
  const curseforges = curseforgeProjects.value.map((p) => {
    const mapping = mappings.value[`curseforge:${p.id}`]
    return {
      id: p.id.toString(), type: 'curseforge', title: p.name, icon_url: p.logo?.thumbnailUrl ?? '', description: p.summary, author: p.authors[0]?.name ?? '',
      labels: [{ icon: 'file_download', text: getExpectedSize(p.downloadCount, ''), id: '' }, { icon: 'event', text: getDateString(p.dateModified), id: ''}, { icon: 'local_offer', text: p.latestFilesIndexes[0]?.gameVersion || '', id: ''}],
      tags: [], gallery: p.screenshots.map(s => s?.thumbnailUrl || ''), localizedTitle: mapping?.name, localizedDescription: mapping?.description,
    } as ExploreProject
  })
  
  let validItems = [...modrinths, ...ftbItems.value, ...curseforges]
  if (sources.value.length > 0) {
      if (!sources.value.includes('modrinth')) validItems = validItems.filter(i => i.type !== 'modrinth')
      if (!sources.value.includes('curseforge')) validItems = validItems.filter(i => i.type !== 'curseforge')
      if (!sources.value.includes('ftb')) validItems = validItems.filter(i => i.type !== 'ftb')
  }
  return validItems
})

const enter = (type: string, id: string) => {
  push(`/store/${type}/${id}`)
}

// --- UI Logic for Filters ---
const expandedPanels = ref([0, 1]) // Open Modloaders and Modrinth categories by default
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

function toggleCurseforgeCategory(id: number) {
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
  @apply font-bold mb-3 text-xs uppercase text-gray-500 tracking-wider ml-1;
}

.filter-group {
  @apply mb-2;
}
</style>
