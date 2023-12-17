<template>
  <v-card
    outlined
    class="flex h-[fit-content] flex-col overflow-auto rounded-lg p-2"
  >
    <span
      class="list-title"
    >{{ t('curseforge.category') }}</span>
    <v-skeleton-loader
      v-if="refreshing"
      class="flex flex-col gap-3 overflow-auto"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
    <ErrorView
      :error="error"
      @refresh="refresh"
    />
    <template v-if="!refreshing">
      <span
        v-for="c of categories"
        :key="c.id"
        v-ripple
        :class="{ selected: c.id === Number(selected) }"
        class="item"
        @click="emit('select', c.id)"
      >
        <img
          class="p-0.5"
          width="30"
          height="30"
          contain
          :src="c.iconUrl"
        >
        {{ tCategory(c.name) }}
      </span>
    </template>
  </v-card>
</template>
<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import { useCurseforgeCategories, useCurseforgeCategoryI18n } from '@/composables/curseforge'

const props = defineProps<{
  type: string
  selected: string
}>()

const emit = defineEmits(['select'])

const { te, t } = useI18n()
const { refresh, refreshing, error, categories: allCategories } = useCurseforgeCategories()
const categories = computed(() => {
  const result = allCategories.value
  if (!result) return []
  const parent = result.find(c => c.slug === props.type)
  return result.filter(r => r.parentCategoryId === parent?.id)
})

const tCategory = useCurseforgeCategoryI18n()

</script>

<style scoped>
.item {
  @apply rounded-lg hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.2)] cursor-pointer p-0.5 flex items-center gap-2 justify-start transition-all;
}

.list-title {
  @apply font-bold text-lg py-1;
}
.selected {
  @apply bg-[rgba(0,0,0,0.1)] dark:bg-[rgba(255,255,255,0.2)];
}

</style>
