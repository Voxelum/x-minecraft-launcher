<template>
  <v-menu
    v-model="focused"
    offset-y
    bottom
    :close-on-click="false"
    :close-on-content-click="false"
  >
    <template #activator="{ }">
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
    </template>
    <v-card
      class="overflow-auto max-h-[80vh] flex flex-col"
      @mousedown.prevent
    >
      <v-tabs v-if="!noTab" v-model="tab" centered fixed-tabs>
        <v-tab>
          {{ t('search.market') }}
        </v-tab>
        <v-tab>
          {{ t('search.local') }}
        </v-tab>
        <v-tab>
          {{ t('search.favorate') }}
        </v-tab>
      </v-tabs>

      <v-tabs-items v-model="tab" class="overflow-auto flex">
        <v-tab-item class="tab">
          <v-subheader class="flex">
            {{ t('modrinth.sort.title') }}
          </v-subheader>
          <v-btn-toggle
            background-color="transparent"
            :value="sort"
            mandatory
            class="bg-transparent px-1"
            @change="emit('update:sort', $event || 'alpha_asc')"
          >
            <v-btn
              v-for="tag in sortByItems"
              :key="tag.value"
              v-shared-tooltip="tag.text"
              small
              outlined
            >
              <v-icon
                class="material-icons-outlined"
                small
              >
                {{ tag.icon }}
              </v-icon>
            </v-btn>
          </v-btn-toggle>

          <v-subheader class="flex">
            {{ t('minecraftVersion.name') }}
          </v-subheader>
          <v-chip-group
            ref="chipGroup"
            v-model="gameVersionModel"
            center-active
            show-arrows
            mandatory
            @wheel.native.stop="onWheel"
          >
            <v-chip
              v-for="v of versionIds"
              :key="v"
              filter
              outlined
              label
            >
              {{ v }}
            </v-chip>
          </v-chip-group>

          <v-subheader
            v-if="modLoaders"
          >
            {{ t('modrinth.modLoaders.name') }}
          </v-subheader>
          <v-btn-toggle
            v-if="modLoaders"
            background-color="transparent"
            class="px-1"
            dense
            :value="modloader"
            @change="emit('update:modloader', $event)"
          >
            <v-btn
              v-for="loader in modLoaders"
              :key="loader"
              outlined
              text
              small
              :value="loader"
            >
              <img
                height="24"
                :src="getIcon(loader)"
              >
            </v-btn>
          </v-btn-toggle>

          <template v-if="modrinthCategoryFilter">
            <v-subheader class="flex gap-1">
              Modrinth
              <div class="flex-grow" />
              <v-switch
                dense
                flat
                :input-value="enableModrinth"
                @change="emit('update:enableModrinth', $event)"
              />
            </v-subheader>
            <v-chip-group
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
          </template>
          <template v-if="curseforgeCategoryFilter">
            <v-subheader class="flex">
              Curseforge

              <div class="flex-grow" />
              <v-switch
                dense
                flat
                :input-value="enableCurseforge"
                @change="emit('update:enableCurseforge', $event)"
              />
            </v-subheader>
            <v-chip-group
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
        </v-tab-item>
        <v-tab-item class="tab">
          <v-subheader class="flex">
            {{ t('modrinth.sort.title') }}
          </v-subheader>
          <v-btn-toggle
            background-color="transparent"
            :value="sortByItems.findIndex(i => i.value === localSort)"
            class="bg-transparent px-1"
            @change="updateLocalSort"
          >
            <v-btn
              v-for="tag in sortByLocalItems"
              :key="tag.value"
              v-shared-tooltip="tag.text"
              small
              outlined
            >
              <v-icon
                class="material-icons-outlined"
                small
              >
                {{ tag.icon }}
              </v-icon>
              <v-icon small>
                {{ tag.value.endsWith('asc') ? 'arrow_upward' : 'arrow_downward' }}
              </v-icon>
            </v-btn>
          </v-btn-toggle>
          

          <slot name="local" />
        </v-tab-item>
        <v-tab-item class="tab">
          <AppCollectionList
            :select="collection"
            @update:select="emit('update:collection', $event)"
          />
        </v-tab-item>
      </v-tabs-items>
    </v-card>
  </v-menu>
</template>
<script setup lang="ts">
import MarketTextField from '@/components/MarketTextField.vue'
import { kCurseforgeCategories } from '@/composables/curseforge'
import { kInstance } from '@/composables/instance'
import { kModrinthTags } from '@/composables/modrinth'
import { useSortByItems } from '@/composables/sortBy'
import { useMinecraftVersions } from '@/composables/version'
import { BuiltinImages } from '@/constant'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useMagicKeys } from '@vueuse/core'
import { ModsSearchSortField } from '@xmcl/curseforge'
import AppCollectionList from './AppCollectionList.vue'
import CurseforgeCategoryChip from './CurseforgeCategoryChip.vue'
import ModrinthCategoryChip from './ModrinthCategoryChip.vue'
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'

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
  sort?: number
  modrinthSort?: 'relevance'| 'downloads' |'follows' |'newest' |'updated'
  curseforgeSort?: ModsSearchSortField

  noTab?: boolean
  collection?: string
  mode?: 'local' | 'remote' | 'favorite'

  localSort?: 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc' | ''

  modLoaders?: string[]
  modloader?: string
}>()

const emit = defineEmits<{
  (event: 'input', value: boolean): void
  (event: 'update:curseforgeCategory', value: number | undefined): void
  (event: 'update:modrinthCategories', value: string[]): void
  (event: 'update:enableCurseforge', value: boolean): void
  (event: 'update:enableModrinth', value: boolean): void
  (event: 'update:keyword', value: string | undefined): void
  (event: 'update:sort', value: number): void
  (event: 'update:modloader', value: string): void
  (event: 'update:localSort', value: 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc'): void
  (event: 'update:gameVersion', value: string): void
  (event: 'update:mode', value: 'local' | 'remote' | 'favorite'): void
  (event: 'update:collection', value: string): void
}>()

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
    interact()
  }
})

const focused = ref(false)
provide('focused', focused)

const { refresh, refreshing, categories: cCategories } = injection(kCurseforgeCategories)
const curseforgeCategories = computed(() => {
  if (!props.curseforgeCategoryFilter) return []
  const result = cCategories.value
  if (!result) return []
  const parent = result.find(c => c.slug === props.curseforgeCategoryFilter)
  return result.filter(r => r.parentCategoryId === parent?.id)
})

const { categories: mCategories } = injection(kModrinthTags)
const _modrinthCategories = computed(() => {
  const result = mCategories.value
  if (!result) return []
  return result.filter(r => r.project_type === props.modrinthCategoryFilter)
})
const { t, te } = useI18n()

const { runtime } = injection(kInstance)
function filterGameVersion(v: string) {
  if (v.indexOf('-') !== -1) return false
  if (!v.startsWith('1.')) return false
  return true
}
const versionIds = computed(() => versions.value.map(v => v.id).filter(filterGameVersion))

const field = ref(null as any)
watch(() => props.curseforgeCategory, (v) => {
  field.value?.focus()
})
watch(() => props.modrinthCategories, (v) => {
  field.value?.focus()
}, { deep: true })

const modrinthSelectModel = computed({
  get() {
    return props.modrinthCategories.map(c => _modrinthCategories.value.findIndex(v => v.name === c))
  },
  set(v) {
    const result = v.map(i => _modrinthCategories.value[i].name)
    emit('update:modrinthCategories', result)
  },
})
const curseforgeSelectModel = computed({
  get() {
    return curseforgeCategories.value.findIndex(v => v.id === props.curseforgeCategory)
  },
  set(v) {
    emit('update:curseforgeCategory', !v ? v : curseforgeCategories.value[v].id)
  },
})
const gameVersionModel = computed({
  get() {
    return versionIds.value.findIndex(v => v === props.gameVersion)
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
  return [{
    icon: 'sort_by_alpha',
    value: 'alpha_asc',
    text: t('sortBy.alphabetAsc')
  }, {
    icon: 'sort_by_alpha',
    value: 'alpha_desc',
    text: t('sortBy.alphabetDesc')
  }, {
    icon: 'calendar_month',
    value: 'time_asc',
    text: t('sortBy.timeAsc'),
  }, {
    icon: 'calendar_month',
    value: 'time_desc',
    text: t('sortBy.timeDesc'),
  }]
})

const chipGroup = ref(null as any)
const onWheel = (e: WheelEvent) => {
  if (e.deltaY > 0) {
    chipGroup.value?.onAffixClick('next')
  } else {
    chipGroup.value?.onAffixClick('prev')
  }
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
  @apply px-2 h-120 w-120 max-h-120 max-w-120 overflow-auto
}
</style>