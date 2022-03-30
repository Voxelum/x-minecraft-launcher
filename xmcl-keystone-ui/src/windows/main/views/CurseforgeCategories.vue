<template>
  <v-card
    v-if="!refreshing"
    outlined
    class="p-2 rounded-lg flex flex-col h-[fit-content] overflow-auto"
  >
    <span
      v-for="c of categories"
      :key="c.id"
      :class="{ selected: c.id === Number(selected) }"
      class="item"
      @click="$emit('select', c.id)"
    >
      <v-avatar>
        <img
          contain
          :src="c.avatarUrl"
        >
      </v-avatar>
      {{ c.name }}
    </span>
  </v-card>
  <v-card
    v-else
    outlined
    class="p-2 rounded-lg flex flex-col h-[fit-content] overflow-auto"
  >
    <v-skeleton-loader
      class="flex flex-col gap-3 overflow-auto"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
  </v-card>
</template>
<script lang="ts">
import { computed, defineComponent, onMounted } from '@vue/composition-api'
import { CurseForgeServiceKey } from '@xmcl/runtime-api'
import { useService } from '/@/composables'
import { useRefreshable } from '/@/composables/refreshable'
import { optional, required } from '/@/util/props'

export default defineComponent({
  props: {
    type: required(String),
    selected: required(String),
  },
  emits: ['select'],
  setup(props) {
    const { state, loadCategories } = useService(CurseForgeServiceKey)
    const { refresh, refreshing } = useRefreshable(async () => {
      await loadCategories()
    })
    const parentCat = computed(() => state.categories.find(c => c.slug === props.type))
    onMounted(() => {
      refresh()
    })
    return {
      parentCat,
      refreshing,
      categories: computed(() => state.categories.filter(c => c.parentGameCategoryId === parentCat.value?.id)),
    }
  },
})
</script>

<style scoped>
.item {
  @apply rounded-lg ml-2 hover:bg-[rgba(255,255,255,0.2)] cursor-pointer p-1 pl-3 flex items-center gap-2;
}

.list-title {
  @apply font-bold text-lg py-1;
}

.selected {
  @apply bg-[rgba(255,255,255,0.2)];
}

</style>
