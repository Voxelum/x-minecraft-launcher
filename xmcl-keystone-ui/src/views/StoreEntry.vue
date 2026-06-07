<template>
  <div class="store-entry h-full w-full overflow-hidden flex flex-col bg-background">
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <div
      class="flex-none py-6 pb-3 grid grid-cols-8 px-3 gap-1 lg:(grid-cols-12 gap-6 px-8) w-full z-10 sticky top-0"
    >
      <div class="hidden lg:(col-span-3 block)"></div>
      <div class="col-span-5 max-w-2xl relative group">
        <v-text-field
          ref="filter"
          v-model="keyword"
          data-testid="store-search"
          variant="solo"
          flat
          hide-details
          rounded="xl"
          density="comfortable"
          :placeholder="t('shared.search')"
          prepend-inner-icon="search"
          class="elevated-search"
        >
          <template #append-inner>
            <v-slide-x-transition>
              <v-icon v-if="keyword" class="cursor-pointer" @click="onClose">close</v-icon>
            </v-slide-x-transition>
          </template>
        </v-text-field>
      </div>
    </div>
    <div class="flex-1 flex overflow-y-auto flex-col lg:(overflow-hidden flex-row)">
      <!--#region Sidebar Filters -->
      <div
        class="w-auto lg:(w-88 overflow-y-auto pb-20) flex-none px-4 pt-4 flex flex-col gap-6 custom-scrollbar"
      >
        <div class="grid grid-cols-3 lg:(flex flex-col) gap-6 flex-shrink-0">
          <!-- Sources -->
          <div class="filter-group">
            <h3 class="filter-title">
              {{ t('modrinth.modpackSource.source') }}
            </h3>
            <div class="flex gap-2">
              <div
                v-for="source in sourcesList"
                :key="source.id"
                class="source-button surface-card-row rounded-xl relative flex-1 flex flex-col items-center justify-center p-3"
                :class="{ omitted: omitSources.includes(source.id) }"
                @click="toggleSource(source.id)"
              >
                <component :is="source.component" class="w-6 h-6 fill-current" />
                <span class="text-xs font-bold mt-2">{{ source.text }}</span>
                <div
                  class="cross-overlay absolute inset-0 flex items-center justify-center rounded-xl transition-opacity duration-200"
                >
                  <v-icon color="red" size="60">close</v-icon>
                </div>
              </div>
            </div>
          </div>
          <!-- Sort -->
          <div class="filter-group">
            <h3 class="filter-title">{{ t('modrinth.sort.title') }}</h3>
            <v-autocomplete
              v-model="sort"
              :items="sortBy"
              item-title="text"
              item-value="value"
              variant="outlined"
              density="compact"
              rounded="lg"
              clearable
              hide-details
              :placeholder="t('modrinth.sort.title')"
            />
          </div>
          <!-- Game Version -->
          <div class="filter-group">
            <h3 class="filter-title">{{ t('modrinth.gameVersions.name') }}</h3>
            <v-autocomplete
              v-model="gameVersion"
              :items="gameVersions"
              item-title="version"
              item-value="version"
              variant="outlined"
              density="compact"
              rounded="lg"
              clearable
              hide-details
              :placeholder="t('modrinth.gameVersions.name')"
            />
          </div>
        </div>

        <!-- ModLoaders -->
        <FilterCard
          :title="t('modrinth.modLoaders.name')"
          :items="
            catModLoaders.map((loader) => ({
              id: loader.name,
              text: loader.name[0].toUpperCase() + loader.name.slice(1),
              iconHTML: loader.icon,
            }))
          "
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
            <v-icon color="orange" size="large">local_fire_department</v-icon>
            {{ t('store.trending') }}
          </h2>
          <v-carousel
            cycle
            height="400"
            hide-delimiter-background
            show-arrows="hover"
            color="white"
            class="rounded-3xl overflow-hidden"
            interval="6000"
          >
            <template #prev="{ props: btnProps }">
              <v-btn
                variant="plain"
                icon="chevron_left"
                :color="arrowColor"
                @click="btnProps.onClick"
              />
            </template>
            <template #next="{ props: btnProps }">
              <v-btn
                variant="plain"
                icon="chevron_right"
                :color="arrowColor"
                @click="btnProps.onClick"
              />
            </template>
            <v-carousel-item v-for="(g, i) in popularItems" :key="i">
              <StoreGallery :gallery="g" @enter="enter(g.type, g.id)" />
            </v-carousel-item>
          </v-carousel>
        </div>

        <!-- Latest Minecraft Section -->
        <section
          v-if="!keyword && selectedCount === 0"
          class="mb-12"
          role="region"
          :aria-labelledby="latestMinecraftHeadingId"
        >
          <h2 :id="latestMinecraftHeadingId" class="text-2xl font-bold mb-6 flex items-center gap-3">
            <v-icon color="green" size="large" aria-hidden="true">xmcl:minecraft</v-icon>
            {{ t('store.latestMinecraft') }}
            <v-btn
              class="ml-2"
              icon="refresh"
              variant="text"
              size="small"
              :aria-label="t('shared.refresh')"
              @click="refreshRecentMinecraft"
            />
          </h2>
          <div
            v-roving-tabindex
            role="group"
            :aria-labelledby="latestMinecraftHeadingId"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <StoreExploreCardModern
              v-for="item in recentMinecraftItems"
              :key="`minecraft-${item.id}`"
              :value="item"
              @click="enter(item.type, item.id)"
            />
          </div>
        </section>

        <!-- Grid -->
        <section class="min-h-screen" role="region" :aria-labelledby="discoverHeadingId">
          <div class="flex items-end justify-between mb-6 gap-2">
            <div>
              <h2 :id="discoverHeadingId" class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ hasFilters ? t('store.searchResult') : t('store.discover') }}
              </h2>
              <p class="text-gray-500 dark:text-gray-400 text-sm mt-1 whitespace-nowrap">
                {{ t('modrinth.projects', { count: items.length }) }}
              </p>
            </div>
            <!-- Active Filters -->
            <div v-if="hasFilters" class="flex justify-end items-center gap-2">
              <div class="flex gap-2 flex-wrap items-center">
                <v-chip
                  v-for="tag in activeTags"
                  :key="`${tag.type}-${tag.id}`"
                  size="small"
                  variant="outlined"
                  closable
                  @click:close="removeTag(tag)"
                >
                  {{ tag.text }}
                </v-chip>
              </div>
              <v-btn
                v-if="hasFilters"
                color="red"
                size="small"
                variant="text"
                prepend-icon="clear"
                @click="clearAllFilters"
              >
                {{ t('shared.cancel') }}
              </v-btn>
            </div>
          </div>
          <div
            v-if="items.length === 0"
            class="flex flex-col justify-center items-center h-96 text-center opacity-50"
          >
            <v-icon size="96" color="grey">mood_bad</v-icon>
            <h3 class="text-2xl font-bold mt-4">{{ t('store.empty') }}</h3>
            <p class="text-gray-400 mt-2">{{ t('store.emptyHint') }}</p>
          </div>
          <div
            v-else
            v-roving-tabindex
            role="group"
            :aria-labelledby="discoverHeadingId"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20"
          >
            <StoreExploreCardModern
              v-for="mod in items"
              :key="mod.id"
              :value="mod"
              @click="enter(mod.type, mod.id)"
            />
          </div>

          <!-- Pagination -->
          <div
            v-if="pageCount > 1"
            class="store-pagination hover:(scale-100 opacity-100) sticky bottom-3 z-10 w-full scale-95 transform opacity-60 transition duration-200 mt-4"
          >
            <v-pagination
              v-model="page"
              :length="pageCount"
              active-color="primary"
              :disabled="isSearching"
              :total-visible="12"
              rounded="circle"
              density="comfortable"
            />
          </div>
        </section>
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
import { useDateString } from '@/composables/date'
import { kModrinthTags } from '@/composables/modrinth'
import { useQuery, useQueryNumber, useQueryStringArray } from '@/composables/query'
import { useSortByItems } from '@/composables/sortBy'
import { useTextFieldBehavior } from '@/composables/textfieldBehavior'
import { kTheme } from '@/composables/theme'
import { usePopularItems } from '@/composables/usePopularItems'
import { useRecentMinecraftItems } from '@/composables/useRecentMinecraftItems'
import { useSearchedItems } from '@/composables/useSearchedItems'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { injection } from '@/util/inject'
import { useFocus } from '@vueuse/core'
import { useId } from 'vue'

const { push } = useRouter()
const { t } = useI18n()
const { isDark } = injection(kTheme)
const arrowColor = computed(() => (isDark.value ? 'white' : 'black'))

const latestMinecraftHeadingId = useId()
const discoverHeadingId = useId()

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
const sort = useQuery('sort', (q) => {
  q.page = '1'
})
const page = useQueryNumber('page', 1)
const omitSources = useQueryStringArray('omitSources', ensureQuery)
const keyword = ref(query)
const _modrinthCategories = useQueryStringArray('modrinthCategories', ensureQuery)
const curseforgeCategory = useQueryNumber(
  'curseforgeCategory',
  undefined as undefined | number,
  ensureQuery,
)
const pageSize = 20

// --- Data Fetching Logic ---
const tCategory = useCurseforgeCategoryI18n()
const { getDateString } = useDateString()
const galleryMappings = ref<Record<string, { name: string; description: string }>>({})

const { items, isSearching, searchError, pageCount } = useSearchedItems({
  query,
  gameVersion,
  modLoaders,
  sort,
  page,
  omitSources,
  modrinthCategories: _modrinthCategories,
  curseforgeCategory,
  pageSize,
  tCategory,
})

const { popularItems } = usePopularItems(galleryMappings)

const { recentMinecraftItems: allRecentMinecraftItems } = useRecentMinecraftItems(galleryMappings)

// Display only 8 items, with rotation support
const recentMinecraftOffset = ref(0)

const recentMinecraftItems = computed(() => {
  const items = allRecentMinecraftItems.value
  if (items.length === 0) return []
  const offset = recentMinecraftOffset.value % items.length
  // Rotate items starting from offset and take 8
  const rotated = [...items.slice(offset), ...items.slice(0, offset)]
  return rotated.slice(0, 8)
})

const refreshRecentMinecraft = () => {
  recentMinecraftOffset.value += 8
}

// Search Logic
const sortBy = useSortByItems()

const loading = computed(() => isSearching.value)

// Mappings for results
const mappings = ref<Record<string, { name: string; description: string }>>({})
const {
  refreshing: refreshingTag,
  categories: modrinthCategories,
  modLoaders: modrinthModloaders,
  gameVersions,
} = injection(kModrinthTags)
const { categories: curseforgeCategories } = injection(kCurseforgeCategories)
const catModLoaders = computed(() =>
  modrinthModloaders.value.filter((v) => v.supported_project_types.includes('modpack')),
)

const enter = (type: string, id: string) => {
  push(`/store/${type}/${id}`)
}

// --- UI Logic for Filters ---
const sourcesList = [
  { id: 'modrinth', text: 'Modrinth', component: ModrinthIcon },
  { id: 'curseforge', text: 'CurseForge', component: CurseforgeIcon },
  { id: 'ftb', text: 'FTB', component: FTBIcon },
]

function toggleSource(id: string) {
  if (omitSources.value.includes(id)) {
    omitSources.value = omitSources.value.filter((s) => s !== id)
  } else {
    omitSources.value = [...omitSources.value, id]
  }
}

// Categories Display
const modrinthCategoriesDisplay = computed(() => {
  return modrinthCategories.value
    .filter((v) => v.project_type === 'modpack')
    .map((c) => ({
      id: c.name,
      text: t(`modrinth.categories.${c.name}`, c.name),
      iconHTML: c.icon,
    }))
})

function toggleModLoader(name: string) {
  if (modLoaders.value.includes(name)) {
    modLoaders.value = modLoaders.value.filter((n) => n !== name)
  } else {
    modLoaders.value = [...modLoaders.value, name]
  }
}

// CurseForge Categories Display
const curseforgeCategoriesDisplay = computed(() => {
  return (curseforgeCategories.value?.filter((c) => c.parentCategoryId === 4471) || []).map(
    (c) => ({
      id: c.id.toString(),
      text: tCategory(c.name),
      icon: c.iconUrl,
    }),
  )
})

function toggleModrinthCategory(id: string) {
  if (_modrinthCategories.value.includes(id)) {
    _modrinthCategories.value = _modrinthCategories.value.filter((c) => c !== id)
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
  const tags: {
    id: string
    text: string
    type: 'source' | 'version' | 'sort' | 'loader' | 'category'
  }[] = []

  omitSources.value.forEach((s) =>
    tags.push({ id: s, text: sourcesList.find((x) => x.id === s)?.text || s, type: 'source' }),
  )
  if (gameVersion.value)
    tags.push({ id: gameVersion.value, text: gameVersion.value, type: 'version' })
  modLoaders.value.forEach((l) => tags.push({ id: l, text: l, type: 'loader' }))
  _modrinthCategories.value.forEach((c) =>
    tags.push({
      id: c,
      text: modrinthCategoriesDisplay.value.find((x) => x.id === c)?.text || c,
      type: 'category',
    }),
  )
  if (curseforgeCategory.value) {
    const name = curseforgeCategoriesDisplay.value.find(
      (x) => x.id === curseforgeCategory.value?.toString(),
    )?.text
    tags.push({
      id: curseforgeCategory.value.toString(),
      text: name || 'Category',
      type: 'category',
    })
  }

  return tags
})

const selectedCount = computed(() => activeTags.value.length)

function removeTag(tag: any) {
  if (tag.type === 'source') toggleSource(tag.id)
  if (tag.type === 'version') gameVersion.value = ''
  if (tag.type === 'loader') modLoaders.value = modLoaders.value.filter((l) => l !== tag.id)
  if (tag.type === 'category') {
    if (_modrinthCategories.value.includes(tag.id)) toggleModrinthCategory(tag.id)
    else toggleCurseforgeCategory(Number(tag.id))
  }
}

function clearAllFilters() {
  omitSources.value = []
  gameVersion.value = ''
  modLoaders.value = []
  _modrinthCategories.value = []
  curseforgeCategory.value = undefined
}

function onClose() {
  query.value = ''
  keyword.value = ''
}

const hasFilters = computed(() => selectedCount.value > 0 || !!keyword.value)

const filter = ref<HTMLElement | null>(null)
const { focused } = useFocus(filter)
useTextFieldBehavior(filter, focused)
</script>

<style scoped>
.store-entry {
  user-select: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.4);
}

.theme--dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
}

.theme--dark .custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
}

/* Elevated Search Input */
.elevated-search :deep(.v-field) {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.elevated-search.v-input--focused :deep(.v-field),
.elevated-search :deep(.v-field--focused) {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2) !important;
  transform: translateY(-1px);
}

.theme--dark .elevated-search :deep(.v-field) {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
}

.theme--dark .elevated-search :deep(.v-field--focused) {
  box-shadow: 0 8px 30px rgba(var(--v-theme-primary), 0.2) !important;
}

/* Pagination styling */
.store-pagination :deep(.v-pagination__item .v-btn),
.store-pagination :deep(.v-pagination__prev .v-btn),
.store-pagination :deep(.v-pagination__next .v-btn) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-title {
  @apply font-bold mb-3 text-xs uppercase text-gray-700 dark:text-gray-300 tracking-wider ml-1;
}

.filter-group {
  @apply mb-2;
}

/* Source Button Styles — shape + border + hover-border come from the
   shared `.surface-card-row` utility. Only the colour-tone bits and
   the omitted (off) override live here. */
.source-button {
  @apply text-gray-600 dark:text-gray-400;
}

.source-button .cross-overlay {
  opacity: 0;
}

/* Off-state: transparent shell, no border swap on hover */
.source-button.omitted,
.source-button.omitted:hover {
  background: transparent;
  border-color: transparent;
}

.source-button.omitted {
  @apply text-gray-400 dark:text-gray-500;
}

.source-button.omitted .cross-overlay {
  opacity: 0.5;
}

.source-button:hover .cross-overlay {
  opacity: 1;
}
</style>
