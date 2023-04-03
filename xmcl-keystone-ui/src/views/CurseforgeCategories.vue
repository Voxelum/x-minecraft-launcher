<template>
  <v-card
    outlined
    class="p-2 rounded-lg flex flex-col h-[fit-content] overflow-auto"
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
import { ModCategory } from '@xmcl/curseforge'
import { CurseForgeServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import { useRefreshable } from '@/composables/refreshable'
import ErrorView from '@/components/ErrorView.vue'

const props = defineProps<{
  type: string
  selected: string
}>()

const emit = defineEmits(['select'])

const { te, t } = useI18n()
const { fetchCategories } = useService(CurseForgeServiceKey)
const allCategories = ref([] as ModCategory[])
const categories = computed(() => {
  const result = allCategories.value
  const parent = result.find(c => c.slug === props.type)
  return result.filter(r => r.parentCategoryId === parent?.id)
})

const tCategory = (k: string) => te(`curseforgeCategory.${k}`) ? t(`curseforgeCategory.${k}`) : k

const { refresh, refreshing, error } = useRefreshable(async () => {
  const result = await fetchCategories()
  allCategories.value = result
})
onMounted(() => {
  refresh()
})

</script>

<style scoped>
.item {
  @apply rounded-lg hover:bg-[rgba(255,255,255,0.2)] cursor-pointer p-0.5 flex items-center gap-2 justify-start;
}

.list-title {
  @apply font-bold text-lg py-1;
}

.selected {
  @apply bg-[rgba(255,255,255,0.2)];
}

</style>
