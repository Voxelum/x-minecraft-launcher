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
        @clear="onClear"
        @input="emit('update:keyword', $event)"
      />
    </template>
    <v-card
      color="secondary"
      class="max-w-100 max-h-100 overflow-auto px-2"
      @mousedown.prevent
    >
      <v-subheader>
        Modrinth
      </v-subheader>
      <v-chip-group
        v-model="modrinthSelectModel"
        column
        multiple
      >
        <v-chip
          v-for="tag in _modrinthCategories"
          :key="tag.name"
          filter
          outlined
          label
        >
          <v-avatar
            v-if="tag.icon"
            left
            v-html="tag.icon"
          />
          {{ t('modrinth.categories.' + tag.name) }}
        </v-chip>
      </v-chip-group>
      <template v-if="curseforgeCategoryFilter">
        <v-subheader>
          Curseforge
        </v-subheader>
        <v-chip-group
          v-model="curseforgeSelectModel"
          column
        >
          <v-chip
            v-for="c of curseforgeCategories"
            :key="c.id"
            filter
            outlined
            label
          >
            <v-avatar
              left
            >
              <v-img
                :src="c.iconUrl"
              />
            </v-avatar>

            {{ tCategory(c.name) }}
          </v-chip>
        </v-chip-group>
      </template>
    </v-card>
  </v-menu>
</template>
<script setup lang="ts">
import MarketTextField from '@/components/MarketTextField.vue'
import { useCurseforgeCategories } from '@/composables/curseforge'
import { useModrinthTags } from '@/composables/modrinth'

const props = defineProps<{
  curseforgeCategory?: number | undefined
  modrinthCategories: string[]
  curseforgeCategoryFilter?: string
  modrinthCategoryFilter: string
  keyword: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (event: 'input', value: boolean): void
  (event: 'update:curseforgeCategory', value: number | undefined): void
  (event: 'update:modrinthCategories', value: string[]): void
  (event: 'update:keyword', value: string | undefined): void
}>()

const focused = ref(false)
provide('focused', focused)

const { refresh, refreshing, categories: cCategories } = useCurseforgeCategories()
const curseforgeCategories = computed(() => {
  if (!props.curseforgeCategoryFilter) return []
  const result = cCategories.value
  if (!result) return []
  const parent = result.find(c => c.slug === props.curseforgeCategoryFilter)
  return result.filter(r => r.parentCategoryId === parent?.id)
})

const { refreshing: refreshingTag, categories: mCategories, error: tagError } = useModrinthTags()
const _modrinthCategories = computed(() => {
  const result = mCategories.value
  if (!result) return []
  return result.filter(r => r.project_type === props.modrinthCategoryFilter)
})
const { t, te } = useI18n()

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
const tCategory = (k: string) => te(`curseforgeCategory.${k}`) ? t(`curseforgeCategory.${k}`) : k

const onClear = () => {
  emit('update:curseforgeCategory', undefined)
  emit('update:modrinthCategories', [])
}
</script>
