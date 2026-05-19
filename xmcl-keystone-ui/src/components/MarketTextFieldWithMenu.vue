<template>
  <div
    ref="anchor"
    class="market-text-field-with-menu flex flex-grow justify-end"
    @keydown.tab.exact="onTabFromField"
  >
    <MarketTextField
      ref="field"
      :clearable="!!curseforgeCategory || modrinthCategories.length > 0 || !!keyword"
      :value="keyword"
      :placeholder="placeholder"
      :game-version="gameVersion !== runtime.minecraft ? gameVersion : undefined"
      :category="!!curseforgeCategory || modrinthCategories.length > 0"
      :icon="tab === 0 ? 'file_download' : tab === 1 ? 'search' : 'favorite'"
      @clear="onClear"
      @clear-version="emit('update:gameVersion', runtime.minecraft)"
      @input="emit('update:keyword', $event)"
      @clear-category="onClear"
    />
    <v-menu
      v-model="showMenu"
      :target="anchor"
      location="bottom"
      min-width="480"
      :close-on-click="false"
      :close-on-content-click="false"
    >
      <v-card
        ref="menuCard"
        class="overflow-auto max-h-[80vh] flex flex-col modern-filter-card"
        @mousedown.prevent
      >
        <v-tabs
          v-if="!noTab"
          v-model="tab"
          color="primary"
          slider-color="primary"
          align-tabs="center"
          fixed-tabs
        >
          <v-tab :value="0">
            {{ t('search.market') }}
          </v-tab>
          <v-tab :value="1">
            {{ t('search.local') }}
          </v-tab>
          <v-tab :value="2">
            {{ t('search.favorate') }}
          </v-tab>
        </v-tabs>

        <v-tabs-window v-model="tab" class="overflow-auto flex">
          <v-tabs-window-item :value="0" class="tab">
            <div class="filter-subheader flex">
              {{ t('modrinth.sort.title') }}
            </div>
            <v-btn-toggle
              v-roving-tabindex
              :aria-label="t('modrinth.sort.title')"
              :model-value="sort"
              mandatory
              density="compact"
              divided
              class="px-1"
              @update:model-value="emit('update:sort', $event || 'alpha_asc')"
            >
              <v-btn
                v-for="tag in sortByItems"
                :key="tag.value"
                v-shared-tooltip="tag.text"
                class="transition-all duration-200"
                size="small"
                variant="text"
                border
              >
                <v-icon class="material-icons-outlined" size="small">
                  {{ tag.icon }}
                </v-icon>
              </v-btn>
            </v-btn-toggle>

            <div class="filter-subheader flex">
              {{ t('minecraftVersion.name') }}
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
              <v-chip v-for="v of versionIds" :key="v" filter variant="outlined" label>
                {{ v }}
              </v-chip>
            </v-chip-group>

            <div class="filter-subheader" v-if="modLoaders">
              {{ t('modrinth.modLoaders.name') }}
            </div>
            <v-btn-toggle
              v-if="modLoaders"
              v-roving-tabindex
              :aria-label="t('modrinth.modLoaders.name')"
              class="px-1"
              density="compact"
              divided
              :model-value="modloader"
              @update:model-value="emit('update:modloader', $event)"
            >
              <v-btn
                v-for="loader in modLoaders"
                :key="loader"
                :value="loader"
                size="small"
                variant="text"
                border
              >
                <img height="24" :src="getIcon(loader)" />
              </v-btn>
            </v-btn-toggle>

            <template v-if="modrinthCategoryFilter">
              <div class="filter-subheader flex gap-1">
                Modrinth
                <div class="flex-grow" />
                <v-switch
                  density="compact"
                  hide-details
                  color="primary"
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
              <div class="filter-subheader flex">
                {{ t('modrinth.environments.name') }}
              </div>
              <v-btn-toggle
                v-roving-tabindex
                :aria-label="t('modrinth.environments.name')"
                background-color="transparent"
                class="px-1"
                variant="outlined"
                density="compact"
                :model-value="modrinthEnvironment"
                :disabled="!enableModrinth"
                @update:model-value="emit('update:modrinthEnvironment', $event || '')"
              >
                <v-btn
                  v-shared-tooltip="t('modrinth.environments.all')"
                  value=""
                  :disabled="!enableModrinth"
                  size="small"
                >
                  <v-icon size="small"> devices </v-icon>
                </v-btn>
                <v-btn
                  v-shared-tooltip="t('shared.client')"
                  value="client"
                  :disabled="!enableModrinth"
                  size="small"
                >
                  <v-icon size="small"> computer </v-icon>
                </v-btn>
                <v-btn
                  v-shared-tooltip="t('shared.server')"
                  value="server"
                  :disabled="!enableModrinth"
                  size="small"
                >
                  <v-icon size="small"> dns </v-icon>
                </v-btn>
              </v-btn-toggle>
            </template>
            <template v-if="curseforgeCategoryFilter">
              <div class="filter-subheader flex">
                CurseForge
                <div class="flex-grow" />
                <v-switch
                  density="compact"
                  hide-details
                  color="primary"
                  :model-value="enableCurseforge"
                  @update:model-value="emit('update:enableCurseforge', !!$event)"
                />
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
            </template>
          </v-tabs-window-item>
          <v-tabs-window-item :value="1" class="tab">
            <div class="filter-subheader flex">
              {{ t('modrinth.sort.title') }}
            </div>
            <v-btn-toggle
              v-roving-tabindex
              :aria-label="t('modrinth.sort.title')"
              background-color="transparent"
              density="compact"
              :rounded="10"
              :model-value="sortByItems.findIndex((i) => i.value === localSort)"
              variant="outlined"
              class="bg-transparent px-1"
              @update:model-value="updateLocalSort"
            >
              <v-btn
                v-for="tag in sortByLocalItems"
                :key="tag.value"
                v-shared-tooltip="tag.text"
                size="small"
              >
                <v-icon class="material-icons-outlined" size="small">
                  {{ tag.icon }}
                </v-icon>
                <v-icon size="small">
                  {{ tag.value.endsWith('asc') ? 'arrow_upward' : 'arrow_downward' }}
                </v-icon>
              </v-btn>
            </v-btn-toggle>

            <slot name="local" />
          </v-tabs-window-item>
          <v-tabs-window-item :value="2" class="tab">
            <AppCollectionList
              :select="collection"
              @update:select="emit('update:collection', $event)"
            />
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card>
    </v-menu>
  </div>
</template>
<script setup lang="ts">
import MarketTextField from '@/components/MarketTextField.vue'
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
import CurseforgeCategoryChip from './CurseforgeCategoryChip.vue'
import ModrinthCategoryChip from './ModrinthCategoryChip.vue'
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { getSelectableGameVersionIds } from '@/util/gameVersion'

const props = defineProps<{
  curseforgeCategory?: number | undefined
  gameVersion: string
  modrinthCategories: string[]
  curseforgeCategoryFilter?: string
  modrinthCategoryFilter?: string
  enableCurseforge?: boolean
  enableModrinth?: boolean
  keyword: string
  placeholder?: string
  sort?: number | string
  modrinthSort?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  curseforgeSort?: ModsSearchSortField

  noTab?: boolean
  collection?: string
  mode?: 'local' | 'remote' | 'favorite'

  localSort?: 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc' | ''

  modLoaders?: string[]
  modloader?: string

  modrinthEnvironment?: '' | 'client' | 'server'
}>()

const emit = defineEmits<{
  input: [value: boolean]
  'update:curseforgeCategory': [value: number | undefined]
  'update:modrinthCategories': [value: string[]]
  'update:enableCurseforge': [value: boolean]
  'update:enableModrinth': [value: boolean]
  'update:keyword': [value: string | undefined]
  'update:sort': [value: number | string]
  'update:modloader': [value: string]
  'update:localSort': [value: 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc']
  'update:gameVersion': [value: string]
  'update:mode': [value: 'local' | 'remote' | 'favorite']
  'update:collection': [value: string]
  'update:modrinthEnvironment': [value: '' | 'client' | 'server']
}>()

const showMenu = ref(false)
provide('focused', showMenu)
const anchor = ref(null as any)
const menuCard = ref(null as any)

/**
 * When focus is in the search input and the filter menu is open, intercept
 * the next Tab and move focus into the menu instead of leaving the field
 * for whatever comes next in the page. Makes the menu the next tab stop.
 */
function onTabFromField(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (!target || target.tagName !== 'INPUT') return
  if (!showMenu.value) return
  const card = (menuCard.value as any)?.$el as HTMLElement | undefined
  if (!card) return
  const selector =
    'button, a[href], [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  const first = Array.from(card.querySelectorAll<HTMLElement>(selector)).find((el) => {
    if (el.hasAttribute('disabled')) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false
    return true
  })
  if (first) {
    e.preventDefault()
    first.focus()
  }
}

const { versions } = useMinecraftVersions()
const tab = computed({
  get() {
    return props.mode === 'local' ? 1 : props.mode === 'remote' ? 0 : 2
  },
  set(v) {
    if (v === 0) {
      emit('update:mode', 'remote')
    } else if (v === 1) {
      emit('update:mode', 'local')
    } else {
      emit('update:mode', 'favorite')
    }
  },
})

const { interact } = injection(kModrinthAuthenticatedAPI)
watch(tab, (i) => {
  if (i === 2) {
    // Skip showing the global login dialog: AppCollectionList renders
    // an inline login prompt when not authenticated.
    interact({ silent: true })
  }
})

const { refresh, refreshing, categories: cCategories } = injection(kCurseforgeCategories)
const curseforgeCategories = computed(() => {
  if (!props.curseforgeCategoryFilter) return []
  const result = cCategories.value
  if (!result) return []
  const parent = result.find((c) => c.slug === props.curseforgeCategoryFilter)
  return result.filter((r) => r.parentCategoryId === parent?.id)
})

const { categories: mCategories } = injection(kModrinthTags)
const _modrinthCategories = computed(() => {
  const result = mCategories.value
  if (!result) return []
  return result.filter((r) => r.project_type === props.modrinthCategoryFilter)
})
const { t, te } = useI18n()

const { runtime } = injection(kInstance)
const versionIds = computed(() =>
  getSelectableGameVersionIds(
    versions.value.map((v) => v.id),
    props.gameVersion,
  ),
)

const field = ref(null as any)
watch(
  () => props.curseforgeCategory,
  (v) => {
    field.value?.focus()
  },
)
watch(
  () => props.modrinthCategories,
  (v) => {
    field.value?.focus()
  },
  { deep: true },
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
const gameVersionModel = computed({
  get() {
    return versionIds.value.findIndex((v) => v === props.gameVersion)
  },
  set(v) {
    emit('update:gameVersion', versionIds.value[v])
  },
})

const keys = useMagicKeys()
const localSearchKey = keys['Ctrl+D']
const remoteSearchKey = keys['Ctrl+F']
watch(localSearchKey, (v) => {
  if (v) {
    field.value?.focus()
    nextTick(() => {
      tab.value = 1
    })
  }
})
watch(remoteSearchKey, (v) => {
  if (v) {
    nextTick(() => {
      tab.value = 0
    })
  }
})

const onClear = () => {
  emit('update:curseforgeCategory', undefined)
  emit('update:modrinthCategories', [])
}

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
.v-slide-group__prev {
  min-width: 28px;
}
.v-slide-group__next {
  min-width: 28px;
}
</style>
<style scoped>
.tab {
  @apply px-2 h-120 w-120 max-h-120 max-w-120 overflow-auto;
}

.active-btn {
  @apply ring-2 ring-primary/50 ring-offset-1 ring-offset-transparent;
}
</style>
