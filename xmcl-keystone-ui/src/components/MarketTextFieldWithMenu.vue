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
        @clear="onClear"
        @clear-version="emit('update:gameVersion', runtime.minecraft)"
        @input="emit('update:keyword', $event)"
        @clear-category="onClear"
      />
    </template>
    <v-card
      class="max-w-100 max-h-120 overflow-auto px-2 dark:bg-[#424242]"
      @mousedown.prevent
    >
      <v-subheader class="flex">
        {{ t('modrinth.sort.title') }}
      </v-subheader>
      <v-btn-toggle
        background-color="transparent"
        :value="sort"
        class="bg-transparent px-1"
        @change="emit('update:sort', $event)"
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
        <v-subheader class="flex">
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
    </v-card>
  </v-menu>
</template>
<script setup lang="ts">
import MarketTextField from '@/components/MarketTextField.vue'
import { kCurseforgeCategories, useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { kInstance } from '@/composables/instance'
import { kModrinthTags } from '@/composables/modrinth'
import { useSortByItems } from '@/composables/sortBy'
import { useMinecraftVersions } from '@/composables/version'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ModsSearchSortField } from '@xmcl/curseforge'
import ModrinthCategoryChip from './ModrinthCategoryChip.vue'
import CurseforgeCategoryChip from './CurseforgeCategoryChip.vue'
import { BuiltinImages } from '@/constant'

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
  (event: 'update:gameVersion', value: string): void
}>()

const { versions } = useMinecraftVersions()

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

const tCategory = useCurseforgeCategoryI18n()

const onClear = () => {
  emit('update:curseforgeCategory', undefined)
  emit('update:modrinthCategories', [])
}

const sortByItems = useSortByItems()

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
