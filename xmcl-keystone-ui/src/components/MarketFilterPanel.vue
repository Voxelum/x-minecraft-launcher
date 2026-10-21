<template>
  <v-card
    rounded="0"
    flat
    color="transparent"
    class="market-filter-card flex flex-col w-full h-full modern-filter-card"
    @mousedown.prevent
  >
    <v-tabs
      v-if="!noTab"
      v-model="tab"
      align-tabs="center"
      fixed-tabs
      hide-slider
      class="market-tabs"
      @update:model-value="onTabSelect"
    >
      <v-tab :value="0" prepend-icon="storefront" variant="text" class="market-tab" :selected-class="'market-tab--active'">
        {{ t('search.market') }}
      </v-tab>
      <v-tab :value="1" prepend-icon="inventory_2" variant="text" class="market-tab" :selected-class="'market-tab--active'">
        {{ t('search.local') }}
      </v-tab>
      <v-tab :value="2" prepend-icon="favorite" variant="text" class="market-tab" :selected-class="'market-tab--active'" data-testid="market-filter-favorite-tab">
        {{ t('search.favorate') }}
      </v-tab>
    </v-tabs>

    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div v-show="tab === 0" class="tab">
        <!-- Sort & Page Size Card -->
        <v-card
          class="rounded-xl border border-white/10 bg-white/[0.02] p-3 mb-3"
          elevation="0"
        >
          <div class="filter-sort-size-row">
            <div class="min-w-0">
              <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis flex items-center gap-1.5 mb-2">
                <v-icon size="16" color="primary">sort</v-icon>
                <span>{{ t('modrinth.sort.title') }}</span>
              </div>
              <v-btn-toggle
                v-roving-tabindex
                :aria-label="t('modrinth.sort.title')"
                :model-value="sort"
                mandatory
                density="compact"
                rounded="lg"
                variant="outlined"
                class="w-full"
                @update:model-value="emit('update:sort', $event || 'alpha_asc')"
              >
                <v-btn
                  v-for="tag in sortByItems"
                  :key="tag.value"
                  v-shared-tooltip="tag.text"
                  class="flex-1 transition-all duration-200"
                  size="small"
                >
                  <v-icon class="material-icons-outlined" size="small">
                    {{ tag.icon }}
                  </v-icon>
                </v-btn>
              </v-btn-toggle>
            </div>

            <div class="min-w-0">
              <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis flex items-center gap-1.5 mb-2">
                <v-icon size="16" color="primary">density_medium</v-icon>
                <span>{{ t('search.pageSize') }}</span>
              </div>
              <v-btn-toggle
                v-roving-tabindex
                :aria-label="t('search.pageSize')"
                :model-value="pageSize"
                mandatory
                density="compact"
                rounded="lg"
                variant="outlined"
                class="w-full"
                data-testid="market-page-size"
                @update:model-value="pageSize = $event"
              >
                <v-btn
                  v-for="size in pageSizeOptions"
                  :key="size"
                  :value="size"
                  class="flex-1"
                  size="small"
                >
                  {{ size }}
                </v-btn>
              </v-btn-toggle>
            </div>
          </div>
        </v-card>

        <!-- Game Version & Platform Card -->
        <v-card
          class="rounded-xl border border-white/10 bg-white/[0.02] p-3 mb-3"
          elevation="0"
        >
          <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis flex items-center gap-1.5 mb-2">
            <v-icon size="16" color="primary">view_in_ar</v-icon>
            <span>{{ t('minecraftVersion.name') }}</span>
          </div>
          <v-chip-group
            ref="chipGroup"
            v-roving-tabindex
            :aria-label="t('minecraftVersion.name')"
            v-model="gameVersionModel"
            density="compact"
            center-active
            show-arrows
            mandatory
            @wheel.native.stop="onWheel"
          >
            <v-chip key="__all__" filter variant="outlined" rounded="lg">
              {{ t('minecraftVersion.all') }}
            </v-chip>
            <v-chip v-for="v of versionIds" :key="v" filter variant="outlined" rounded="lg">
              {{ v }}
            </v-chip>
          </v-chip-group>

          <template v-if="modLoaders || modrinthCategoryFilter">
            <v-divider class="my-3 opacity-20" />
            <div class="filter-loader-env-row">
              <div v-if="modLoaders" class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis flex items-center gap-1.5 mb-2">
                  <v-icon size="16" color="primary">extension</v-icon>
                  <span>{{ t('modrinth.modLoaders.name') }}</span>
                </div>
                <v-btn-toggle
                  v-roving-tabindex
                  :aria-label="t('modrinth.modLoaders.name')"
                  density="compact"
                  rounded="lg"
                  variant="outlined"
                  class="w-full"
                  :model-value="modloader"
                  @update:model-value="emit('update:modloader', $event)"
                >
                  <v-btn
                    v-for="loader in modLoaders"
                    :key="loader"
                    :value="loader"
                    class="flex-1"
                    size="small"
                  >
                    <img height="22" :src="getIcon(loader)" />
                  </v-btn>
                </v-btn-toggle>
              </div>
              <div v-if="modrinthCategoryFilter" class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis flex items-center gap-1.5 mb-2">
                  <v-icon size="16" color="primary">devices</v-icon>
                  <span>{{ t('modrinth.environments.name') }}</span>
                </div>
                <v-btn-toggle
                  v-roving-tabindex
                  :aria-label="t('modrinth.environments.name')"
                  density="compact"
                  rounded="lg"
                  variant="outlined"
                  class="w-full"
                  :model-value="modrinthEnvironment"
                  :disabled="!enableModrinth"
                  @update:model-value="emit('update:modrinthEnvironment', $event || '')"
                >
                  <v-btn
                    v-shared-tooltip="t('modrinth.environments.all')"
                    value=""
                    :disabled="!enableModrinth"
                    class="flex-1"
                    size="small"
                  >
                    <v-icon size="small"> devices </v-icon>
                  </v-btn>
                  <v-btn
                    v-shared-tooltip="t('shared.client')"
                    value="client"
                    :disabled="!enableModrinth"
                    class="flex-1"
                    size="small"
                  >
                    <v-icon size="small"> computer </v-icon>
                  </v-btn>
                  <v-btn
                    v-shared-tooltip="t('shared.server')"
                    value="server"
                    :disabled="!enableModrinth"
                    class="flex-1"
                    size="small"
                  >
                    <v-icon size="small"> dns </v-icon>
                  </v-btn>
                </v-btn-toggle>
              </div>
            </div>
          </template>
        </v-card>

        <!-- Content Categories -->
        <div
          class="filter-category-groups"
          :class="{ 'filter-category-groups--dual': modrinthCategoryFilter && curseforgeCategoryFilter }"
        >
          <v-card
            v-if="modrinthCategoryFilter"
            class="filter-category-column rounded-xl border border-white/10 bg-white/[0.02] p-3 mb-3"
            elevation="0"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-medium-emphasis">
                <ModrinthIcon class="h-4 w-4" style="color: #1bd96a" />
                <span>Modrinth</span>
              </div>
              <v-switch
                density="compact"
                hide-details
                color="primary"
                inset
                :model-value="enableModrinth"
                @update:model-value="emit('update:enableModrinth', !!$event)"
              />
            </div>
            <v-chip-group
              v-roving-tabindex="'vertical'"
              :aria-label="t('modrinth.categories.name')"
              v-model="modrinthSelectModel"
              column
              multiple
            >
              <ModrinthCategoryChip
                v-for="tag in _modrinthCategories"
                :key="tag.name"
                :tag="tag"
                :disabled="!enableModrinth"
              />
            </v-chip-group>
          </v-card>

          <v-card
            v-if="curseforgeCategoryFilter"
            class="filter-category-column rounded-xl border border-white/10 bg-white/[0.02] p-3 mb-3"
            elevation="0"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-medium-emphasis">
                <CurseforgeIcon class="h-4 w-4" style="color: #f16436" />
                <span>CurseForge</span>
              </div>
              <v-switch
                density="compact"
                hide-details
                color="primary"
                inset
                :model-value="enableCurseforge"
                @update:model-value="emit('update:enableCurseforge', !!$event)"
              />
            </div>
            <div v-if="curseforgeCategoryLabel" class="text-xs text-medium-emphasis mb-1.5">
              {{ curseforgeCategoryLabel }}
            </div>
            <v-chip-group
              v-roving-tabindex="'vertical'"
              :aria-label="t('modrinth.categories.name')"
              v-model="curseforgeSelectModel"
              column
              :disabled="!enableCurseforge"
            >
              <CurseforgeCategoryChip
                v-for="c of curseforgeCategories"
                :key="c.id"
                :disabled="!enableCurseforge"
                :value="c"
              />
            </v-chip-group>
            <template v-if="curseforgeSecondaryCategoryFilter">
              <v-divider class="my-2.5 opacity-20" />
              <div v-if="curseforgeSecondaryCategoryLabel" class="text-xs text-medium-emphasis mb-1.5">
                {{ curseforgeSecondaryCategoryLabel }}
              </div>
              <v-chip-group
                v-roving-tabindex="'vertical'"
                :aria-label="t('modrinth.categories.name')"
                v-model="curseforgeSecondarySelectModel"
                column
                :disabled="!enableCurseforge"
              >
                <CurseforgeCategoryChip
                  v-for="c of curseforgeSecondaryCategories"
                  :key="c.id"
                  :disabled="!enableCurseforge"
                  :value="c"
                />
              </v-chip-group>
            </template>
          </v-card>
        </div>
      </div>
      <div v-show="tab === 1" class="tab">
        <v-card
          class="sort-card rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-4"
          elevation="0"
        >
          <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis flex items-center gap-1.5 mb-2.5">
            <v-icon size="16" color="primary">sort</v-icon>
            <span>{{ t('modrinth.sort.title') }}</span>
          </div>
          <v-btn-toggle
            v-roving-tabindex
            :aria-label="t('modrinth.sort.title')"
            density="compact"
            rounded="lg"
            :model-value="sortByItems.findIndex((i) => i.value === localSort)"
            variant="outlined"
            class="w-full"
            @update:model-value="updateLocalSort"
          >
            <v-btn
              v-for="tag in sortByLocalItems"
              :key="tag.value"
              v-shared-tooltip="tag.text"
              size="small"
              class="flex-1"
            >
              <v-icon class="material-icons-outlined mr-1" size="small">
                {{ tag.icon }}
              </v-icon>
              <v-icon size="small">
                {{ tag.value.endsWith('asc') ? 'arrow_upward' : 'arrow_downward' }}
              </v-icon>
            </v-btn>
          </v-btn-toggle>
        </v-card>

        <slot name="local" />
      </div>
      <div v-show="tab === 2" class="tab h-full overflow-y-auto">
        <AppLocalCollectionList
          :select="collection"
          @update:select="emit('update:collection', $event)"
        />
        <div class="filter-subheader flex">
          <ModrinthIcon class="mr-1 h-4 w-4" />
          {{ t('localCollection.modrinthSection') }}
        </div>
        <AppCollectionList
          :select="collection"
          @update:select="emit('update:collection', $event)"
        />
      </div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import CurseforgeIcon from '@/components/CurseforgeIcon.vue'
import ModrinthIcon from '@/components/ModrinthIcon.vue'
import { kCurseforgeCategories } from '@/composables/curseforge'
import { kInstance } from '@/composables/instance'
import { kModrinthTags } from '@/composables/modrinth'
import { useSortByItems } from '@/composables/sortBy'
import { useMinecraftVersions } from '@/composables/version'
import { BuiltinImages } from '@/constant'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useMagicKeys } from '@vueuse/core'
import { ModsSearchSortField } from '@xmcl/curseforge'
import AppCollectionList from './AppCollectionList.vue'
import AppLocalCollectionList from './AppLocalCollectionList.vue'
import CurseforgeCategoryChip from './CurseforgeCategoryChip.vue'
import ModrinthCategoryChip from './ModrinthCategoryChip.vue'
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { getSelectableGameVersionIds } from '@/util/gameVersion'
import { MARKET_PAGE_SIZE_OPTIONS, useMarketPageSize } from '@/composables/marketPageSize'

const props = defineProps<{
  curseforgeCategory?: number | undefined
  gameVersion: string
  modrinthCategories: string[]
  curseforgeCategoryFilter?: string
  modrinthCategoryFilter?: string
  enableCurseforge?: boolean
  enableModrinth?: boolean
  sort?: number | string
  modrinthSort?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  curseforgeSort?: ModsSearchSortField

  /**
   * Optional sub-label shown above the primary CurseForge category group.
   * Used when the panel displays two CurseForge category groups.
   */
  curseforgeCategoryLabel?: string
  /**
   * Optional second CurseForge category group (e.g. data packs alongside worlds).
   */
  curseforgeSecondaryCategoryFilter?: string
  curseforgeSecondaryCategory?: number | undefined
  curseforgeSecondaryCategoryLabel?: string

  noTab?: boolean
  collection?: string
  mode?: 'local' | 'remote' | 'favorite'

  localSort?: 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc' | ''

  modLoaders?: string[]
  modloader?: string

  modrinthEnvironment?: '' | 'client' | 'server'
}>()

const emit = defineEmits<{
  'update:curseforgeCategory': [value: number | undefined]
  'update:curseforgeSecondaryCategory': [value: number | undefined]
  'update:modrinthCategories': [value: string[]]
  'update:enableCurseforge': [value: boolean]
  'update:enableModrinth': [value: boolean]
  'update:sort': [value: number | string]
  'update:modloader': [value: string]
  'update:localSort': [value: 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc']
  'update:gameVersion': [value: string]
  'update:mode': [value: 'local' | 'remote' | 'favorite']
  'update:collection': [value: string]
  'update:modrinthEnvironment': [value: '' | 'client' | 'server']
}>()

const { versions } = useMinecraftVersions()
const { pageSize } = useMarketPageSize()
const pageSizeOptions = MARKET_PAGE_SIZE_OPTIONS
const tab = ref(props.mode === 'local' ? 1 : props.mode === 'remote' ? 0 : 2)

watch(() => props.mode, (mode) => {
  const target = mode === 'local' ? 1 : mode === 'remote' ? 0 : 2
  if (tab.value !== target) {
    tab.value = target
  }
})

function onTabSelect(v: any) {
  tab.value = v
  if (v === 0) {
    if (props.mode !== 'remote') emit('update:mode', 'remote')
  } else if (v === 1) {
    if (props.mode !== 'local') emit('update:mode', 'local')
  } else {
    if (props.mode !== 'favorite') emit('update:mode', 'favorite')
  }
}

const { interact } = injection(kModrinthAuthenticatedAPI)
watch(tab, (i) => {
  if (i === 2) {
    // Skip showing the global login dialog: AppCollectionList renders
    // an inline login prompt when not authenticated.
    interact({ silent: true })
  }
})

const { categories: cCategories } = injection(kCurseforgeCategories)
// Some slugs are shared between a top-level class and an unrelated subcategory
// (e.g. `worlds` = class 17 AND an mc-addons subcategory 4560; `data-packs` =
// class 6945 AND a texture-packs subcategory 5193). Always resolve the class
// entry (`isClass`) so the child lookup targets the right parent.
const findCurseforgeClass = (slug: string | undefined) => {
  if (!slug) return undefined
  const result = cCategories.value
  if (!result) return undefined
  return result.find((c) => c.slug === slug && c.isClass) ?? result.find((c) => c.slug === slug)
}
const curseforgeCategories = computed(() => {
  const parent = findCurseforgeClass(props.curseforgeCategoryFilter)
  if (!parent) return []
  return (cCategories.value ?? []).filter((r) => r.parentCategoryId === parent.id)
})
const curseforgeSecondaryCategories = computed(() => {
  const parent = findCurseforgeClass(props.curseforgeSecondaryCategoryFilter)
  if (!parent) return []
  return (cCategories.value ?? []).filter((r) => r.parentCategoryId === parent.id)
})

const { categories: mCategories } = injection(kModrinthTags)
const _modrinthCategories = computed(() => {
  const result = mCategories.value
  if (!result) return []
  // Modrinth has no dedicated `datapack` category set; data packs are indexed
  // under the `mod` project type and reuse its categories.
  const filter = props.modrinthCategoryFilter === 'datapack' ? 'mod' : props.modrinthCategoryFilter
  return result.filter((r) => r.project_type === filter)
})
const { t } = useI18n()

const { runtime } = injection(kInstance)
const versionIds = computed(() =>
  getSelectableGameVersionIds(
    versions.value.map((v) => v.id),
    props.gameVersion,
  ),
)

const modrinthSelectModel = computed({
  get() {
    return props.modrinthCategories.map((c) =>
      _modrinthCategories.value.findIndex((v) => v.name === c),
    )
  },
  set(v) {
    const result = v.map((i) => _modrinthCategories.value[i].name)
    emit('update:modrinthCategories', result)
  },
})
const curseforgeSelectModel = computed({
  get() {
    return curseforgeCategories.value.findIndex((v) => v.id === props.curseforgeCategory)
  },
  set(v) {
    emit('update:curseforgeCategory', !v ? v : curseforgeCategories.value[v].id)
  },
})
const curseforgeSecondarySelectModel = computed({
  get() {
    return curseforgeSecondaryCategories.value.findIndex((v) => v.id === props.curseforgeSecondaryCategory)
  },
  set(v) {
    emit('update:curseforgeSecondaryCategory', !v ? v : curseforgeSecondaryCategories.value[v].id)
  },
})
const gameVersionModel = computed({
  get() {
    // Index 0 is the "All versions" chip (empty game version = no filter).
    if (!props.gameVersion) return 0
    const idx = versionIds.value.findIndex((v) => v === props.gameVersion)
    return idx === -1 ? 0 : idx + 1
  },
  set(v) {
    emit('update:gameVersion', !v ? '' : versionIds.value[v - 1])
  },
})

const keys = useMagicKeys()
const localSearchKey = keys['Ctrl+D']
const remoteSearchKey = keys['Ctrl+F']
watch(localSearchKey, (v) => {
  if (v) {
    nextTick(() => {
      onTabSelect(1)
    })
  }
})
watch(remoteSearchKey, (v) => {
  if (v) {
    nextTick(() => {
      onTabSelect(0)
    })
  }
})

const sortByItems = useSortByItems()

function updateLocalSort(i: number) {
  const item = sortByLocalItems.value[i]
  if (item) {
    emit('update:localSort', item.value as 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc')
  }
}

const sortByLocalItems = computed(() => {
  return [
    {
      icon: 'sort_by_alpha',
      value: 'alpha_asc',
      text: t('sortBy.alphabetAsc'),
    },
    {
      icon: 'sort_by_alpha',
      value: 'alpha_desc',
      text: t('sortBy.alphabetDesc'),
    },
    {
      icon: 'calendar_month',
      value: 'time_asc',
      text: t('sortBy.timeAsc'),
    },
    {
      icon: 'calendar_month',
      value: 'time_desc',
      text: t('sortBy.timeDesc'),
    },
  ]
})

const chipGroup = ref(null as any)
const onWheel = (e: WheelEvent) => {
  // Vuetify 4 renamed/privatized `onAffixClick` on `v-chip-group`, so the
  // ref no longer reliably exposes a callable. Feature-detect and fall back
  // to `scrollTo` (the documented public method) before invoking; without
  // this guard we throw "onAffixClick is not a function" thousands of
  // times in App Insights (issue #1430).
  const group = chipGroup.value as {
    onAffixClick?: (dir: 'next' | 'prev') => void
    scrollTo?: (dir: 'next' | 'prev') => void
  } | null
  const handler = group?.onAffixClick ?? group?.scrollTo
  if (typeof handler !== 'function') return
  handler.call(group, e.deltaY > 0 ? 'next' : 'prev')
  e.preventDefault()
  e.stopPropagation()
}

function getIcon(loader: string) {
  if (loader === 'neoforge') loader = 'neoForged'
  // @ts-ignore
  return BuiltinImages[loader]
}
</script>

<style>
.market-filter-card .v-window__container {
  width: 100%;
}
/* Each filter section starts with a `.filter-subheader`. Add breathing room
   before every section (but not the first one in a tab). Scoped by the card
   class so it also reaches subheaders rendered through the #local slot, which
   live in the consuming view's style scope. */
.market-filter-card .filter-subheader {
  margin-top: 12px;
}
.market-filter-card .tab > .filter-subheader:first-child {
  margin-top: 0;
}
/* Minor sub-label used to separate two category groups under one source
   header (e.g. Worlds vs Data Packs under CurseForge). */
.market-filter-card .filter-subheader--minor {
  margin-top: 8px;
  opacity: 0.7;
  font-size: 0.75rem;
  padding-left: 4px;
}
.v-slide-group__prev {
  min-width: 28px;
}
.v-slide-group__next {
  min-width: 28px;
}
.market-filter-card {
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  min-width: 0;
}
.market-filter-card .market-tabs {
  margin: 6px 12px 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.market-filter-card .market-tabs :deep(.v-btn__overlay),
.market-filter-card .market-tabs :deep(.v-btn__underlay),
.market-filter-card .market-tabs :deep(.v-tab__slider) {
  display: none !important;
}
.market-filter-card .market-tabs :deep(.v-slide-group__content) {
  gap: 3px;
}
.market-filter-card .market-tab {
  border-radius: 9px !important;
  font-weight: 500;
  font-size: 0.85rem;
  text-transform: none;
  letter-spacing: normal;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 32px;
  height: 32px;
  opacity: 0.65;
  color: rgba(255, 255, 255, 0.7) !important;
}
.market-filter-card .market-tab:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.05);
  color: #fff !important;
}
.market-filter-card .market-tab.v-tab--selected,
.market-filter-card .market-tab--active {
  background: rgba(255, 255, 255, 0.12) !important;
  color: #ffffff !important;
  opacity: 1 !important;
  font-weight: 600 !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3) !important;
}
</style>
<style scoped>
.tab {
  @apply px-2 w-full min-w-0 max-h-full overflow-x-hidden gap-2;
}
/* When both Modrinth and CurseForge category groups are present, lay them out
   side by side as two columns. With a single source the column just takes the
   full width (default block flow). */
.filter-category-groups--dual {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.filter-category-column {
  min-width: 0;
}
/* Modloader (left) and environment (right) share one row as two equal columns. */
.filter-loader-env-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
/* Sort (left) and page size (right) share one row as two equal columns. */
.filter-sort-size-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: start;
}
</style>
